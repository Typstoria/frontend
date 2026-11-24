import {
  autocompletion,
  pickedCompletion,
  snippet,
  type Completion,
  type CompletionContext,
} from '@codemirror/autocomplete';
import { Transaction } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import type { Position } from './compilation-diagnostics';
import { cursorPosition, readCompletions, type SuggestedEdit } from './editor-language-results';

export type CompletionRequest = (
  fileId: number,
  position: Position,
  signal: AbortSignal,
  explicit: boolean,
) => Promise<unknown>;

function applySuggestion(view: EditorView, item: SuggestedEdit, completion: Completion) {
  const { edit, extra } = item;
  const annotations = [pickedCompletion.of(completion), Transaction.userEvent.of('input.complete')];
  if (!item.snippet) {
    const earlierEdits = extra.filter((change) => change.from < edit.from);
    const cursor = earlierEdits.reduce(
      (pos, change) => pos + view.state.toText(change.insert).length - (change.to - change.from),
      edit.from + view.state.toText(edit.insert).length,
    );
    view.dispatch({
      changes: [edit, ...extra],
      selection: { anchor: cursor },
      annotations,
      scrollIntoView: true,
    });
    return;
  }
  const template = edit.insert.replace(
    /(?<!\\)\$(\d+)/gu,
    (_, number: string) => '${' + number + '}',
  );
  snippet(template)(
    {
      state: view.state,
      dispatch(transaction) {
        view.dispatch(
          view.state.update(
            {
              changes: transaction.changes,
              selection: transaction.selection,
              effects: transaction.effects,
              annotations,
              scrollIntoView: true,
            },
            {
              changes: extra.map(({ from, to, insert }) => ({
                from: transaction.changes.mapPos(from, 1),
                to: transaction.changes.mapPos(to, -1),
                insert,
              })),
              sequential: true,
            },
          ),
        );
      },
    },
    completion,
    edit.from,
    edit.to,
  );
}

export function editorCompletion(
  current: () => { fileId: number; request: CompletionRequest } | undefined,
  empty: () => void,
) {
  return autocompletion({
    defaultKeymap: false,
    activateOnTypingDelay: 380,
    maxRenderedOptions: 10,
    closeOnBlur: true,
    tooltipClass: () => 'workspace-completions',
    override: [
      async (context: CompletionContext) => {
        const target = current();
        if (!target || context.state.readOnly || context.view?.composing) return null;
        const { state, pos, explicit } = context;
        const line = state.doc.lineAt(pos);
        const prefix = state.sliceDoc(Math.max(line.from, pos - 160), pos);
        if (!explicit && !/#(?:[\p{ID_Continue}-]+\.)*(?:[\p{ID_Continue}-]{2,})?$/u.test(prefix))
          return null;
        const from = context.matchBefore(/[\p{ID_Continue}-]+/u)?.from ?? pos;
        const controller = new AbortController();
        context.addEventListener('abort', () => controller.abort(), { onDocChange: true });
        try {
          const response = await target.request(
            target.fileId,
            cursorPosition(state.doc, pos),
            controller.signal,
            explicit,
          );
          if (context.aborted || current()?.fileId !== target.fileId) return null;
          const items = readCompletions(response, state.doc, from, pos);
          if (!items.length) {
            if (explicit) empty();
            return null;
          }
          return {
            from,
            filter: false,
            options: items.map((item): Completion => ({
              label: item.label,
              ...(item.detail ? { detail: item.detail } : {}),
              ...(item.type ? { type: item.type } : {}),
              apply(view, completion) {
                if (
                  !view.state.readOnly &&
                  view.state.doc === state.doc &&
                  current()?.fileId === target.fileId
                )
                  applySuggestion(view, item, completion);
              },
            })),
          };
        } catch {
          return null;
        }
      },
    ],
  });
}
