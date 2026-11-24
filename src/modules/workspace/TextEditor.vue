<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { EditorState, StateEffectType } from '@codemirror/state';
import type { DecorationSet, EditorView } from '@codemirror/view';
import type { TextSelection } from './text-anchor';
import type { CommentLayout } from './comment-layout';
import type { CompletionRequest } from './editor-completion';
import { cursorPosition, readFormatting } from './editor-language-results';

const props = defineProps<{
  modelValue: string;
  documentId: number;
  readonly?: boolean;
  resetKey?: number;
  annotations?: (TextSelection & { id: number })[];
  showCommentGutter?: boolean;
  canComment?: boolean;
  alignComments?: boolean;
  activeAnnotation?: number | null;
  complete?: CompletionRequest;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string, fileId: number];
  save: [];
  composition: [active: boolean];
  selection: [documentId: number, selection: TextSelection | null];
  annotation: [id: number];
  'gutter-comment': [id: number];
  comment: [];
  'language-command': [method: 'formatting' | 'definition'];
  'completion-empty': [];
  'comment-layout': [layout: CommentLayout];
}>();

const host = ref<HTMLElement | null>(null);
const viewport = ref<HTMLElement | null>(null);
const commentButton = ref<{ x: number; y: number } | null>(null);
type CommentMarker = { id: number; line: number; y: number; height: number };
const gutterButtons = ref<CommentMarker[]>([]);
const measureKey = {};
const states = new Map<number, EditorState>();
const scrollSnapshots = new Map<number, ReturnType<EditorView['scrollSnapshot']>>();
let view: EditorView | undefined;
let modules: typeof import('@codemirror/view') | undefined;
let stateModule: typeof import('@codemirror/state') | undefined;
let readonlyCompartment: import('@codemirror/state').Compartment | undefined;
let annotationEffect: StateEffectType<DecorationSet> | undefined;
let baseExtensions: import('@codemirror/state').Extension[] = [];
let activeDocumentId = props.documentId;
let composing = false;
let destroyed = false;
let syncingExternalValue = false;
let ready: Promise<void> | undefined;
let startCompletion: typeof import('@codemirror/autocomplete').startCompletion | undefined;

function dispatchExternalValue(value: string) {
  if (!view || view.state.doc.toString() === value) return;
  syncingExternalValue = true;
  try {
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
  } finally {
    syncingExternalValue = false;
  }
}

function reconfigureReadonly(readonly: boolean) {
  if (!view || !modules || !stateModule || !readonlyCompartment) return;
  view.dispatch({
    effects: readonlyCompartment.reconfigure([
      stateModule.EditorState.readOnly.of(readonly),
      modules.EditorView.editable.of(!readonly),
    ]),
  });
}
function restoreScroll(documentId: number) {
  if (!view || !modules) return;
  view.dispatch({
    effects:
      scrollSnapshots.get(documentId) ?? modules.EditorView.scrollIntoView(0, { y: 'start' }),
  });
}

function sendSelection() {
  const selection = view?.state.selection.main;
  emit(
    'selection',
    activeDocumentId,
    selection?.empty === false ? { from: selection.from, to: selection.to } : null,
  );
}

function measureComments() {
  view?.requestMeasure({
    key: measureKey,
    read(editor) {
      const bounds = editor.scrollDOM.getBoundingClientRect();
      const parent = host.value?.getBoundingClientRect();
      const selection = editor.state.selection.main;
      const end =
        props.canComment && !selection.empty && !composing
          ? editor.coordsAtPos(selection.to, -1)
          : null;
      const button =
        end && parent && bounds.height > 0 && end.bottom >= bounds.top && end.top < bounds.bottom
          ? {
              x: Math.max(4, Math.min(parent.width - 48, end.right - parent.left + 6)),
              y: Math.max(4, Math.min(parent.height - 48, end.bottom - parent.top + 4)),
            }
          : null;
      const layout =
        props.alignComments && bounds.height > 0
          ? {
              fileId: activeDocumentId,
              viewportTop: bounds.top,
              scrollTop: editor.scrollDOM.scrollTop,
              scrollHeight: editor.scrollDOM.scrollHeight,
              positions: Object.fromEntries(
                (props.annotations ?? []).map(({ id, from }) => [
                  id,
                  editor.lineBlockAt(Math.min(from, editor.state.doc.length)).top +
                    editor.documentTop -
                    bounds.top +
                    editor.scrollDOM.scrollTop,
                ]),
              ),
            }
          : null;
      const gutter = new Map<number, CommentMarker>();
      if (props.showCommentGutter && parent && bounds.height > 0) {
        const height = editor.defaultLineHeight;
        for (const { id, from } of props.annotations ?? []) {
          if (from > editor.state.doc.length) continue;
          const sourceLine = editor.state.doc.lineAt(from);
          if (gutter.has(sourceLine.number)) continue;
          const top = editor.lineBlockAt(sourceLine.from).top + editor.documentTop;
          const center = top + height / 2;
          if (center >= bounds.top && center < bounds.bottom) {
            gutter.set(sourceLine.number, {
              id,
              line: sourceLine.number,
              y: center - parent.top,
              height,
            });
          }
        }
      }
      return { button, layout, gutter: [...gutter.values()].sort((a, b) => a.line - b.line) };
    },
    write({ button, layout, gutter }) {
      commentButton.value = button;
      if (gutter.length || gutterButtons.value.length) gutterButtons.value = gutter;
      if (layout) emit('comment-layout', layout);
    },
  });
}

function updateAnnotations() {
  if (!view || !modules || !annotationEffect) return;
  const { Decoration } = modules;
  const length = view.state.doc.length;
  const marks = (props.showCommentGutter ? [] : (props.annotations ?? []))
    .filter(({ from, to }) => from >= 0 && from < to && to <= length)
    .map(({ from, to, id }) =>
      Decoration.mark({
        class:
          id === props.activeAnnotation
            ? 'cm-annotation-mark cm-annotation-current'
            : 'cm-annotation-mark',
        attributes: { 'data-annotation-id': String(id) },
      }).range(from, to),
    );
  view.dispatch({
    effects: annotationEffect.of(Decoration.set(marks, true)),
  });
}

async function initialize() {
  const [loadedStateModule, viewModule, commandsModule, autocomplete, { editorCompletion }] =
    await Promise.all([
      import('@codemirror/state'),
      import('@codemirror/view'),
      import('@codemirror/commands'),
      import('@codemirror/autocomplete'),
      import('./editor-completion'),
    ]);
  if (destroyed || !viewport.value) return;
  startCompletion = autocomplete.startCompletion;
  stateModule = loadedStateModule;
  modules = viewModule;
  readonlyCompartment = new loadedStateModule.Compartment();
  const setAnnotations = loadedStateModule.StateEffect.define<DecorationSet>();
  annotationEffect = setAnnotations;
  const annotations = loadedStateModule.StateField.define<DecorationSet>({
    create: () => viewModule.Decoration.none,
    update(marks, transaction) {
      for (const effect of transaction.effects) if (effect.is(setAnnotations)) return effect.value;
      return transaction.docChanged ? marks.map(transaction.changes) : marks;
    },
    provide: (field) => viewModule.EditorView.decorations.from(field),
  });

  baseExtensions = [
    commandsModule.history(),
    viewModule.lineNumbers(),
    viewModule.highlightActiveLine(),
    viewModule.highlightActiveLineGutter(),
    editorCompletion(
      () =>
        props.complete && !composing
          ? { request: props.complete, fileId: activeDocumentId }
          : undefined,
      () => emit('completion-empty'),
    ),
    loadedStateModule.Prec.high(
      viewModule.keymap.of([
        ...autocomplete.completionKeymap.filter((binding) => binding.key !== 'Ctrl-Space'),
        {
          key: 'Ctrl-Space',
          run(editor) {
            return (
              !!props.complete &&
              !composing &&
              !editor.state.readOnly &&
              autocomplete.startCompletion(editor)
            );
          },
        },
      ]),
    ),
    viewModule.keymap.of([
      {
        key: 'Mod-Alt-m',
        run: () => {
          if (!props.canComment || composing) return false;
          emit('comment');
          return true;
        },
      },
      {
        key: 'Shift-Alt-f',
        run: (editor) => {
          if (!props.complete || editor.state.readOnly || composing) return false;
          emit('language-command', 'formatting');
          return true;
        },
      },
      {
        key: 'F12',
        run: (editor) => {
          if (!props.complete || editor.state.readOnly || composing) return false;
          emit('language-command', 'definition');
          return true;
        },
      },
      {
        key: 'Mod-s',
        run: () => {
          emit('save');
          return true;
        },
      },
      {
        key: 'Tab',
        run: (editor) => {
          if (editor.state.readOnly) return false;
          if (editor.state.selection.ranges.some((range) => !range.empty))
            return commandsModule.indentMore(editor);
          editor.dispatch(editor.state.replaceSelection('  '));
          return true;
        },
        shift: commandsModule.indentLess,
      },
      {
        key: 'Escape',
        run: (editor) => {
          commandsModule.simplifySelection(editor);
          editor.setTabFocusMode(2000);
          return true;
        },
      },
      ...commandsModule.historyKeymap,
      ...commandsModule.defaultKeymap,
    ]),
    viewModule.EditorView.lineWrapping,
    loadedStateModule.EditorState.tabSize.of(2),
    annotations,
    readonlyCompartment.of([
      loadedStateModule.EditorState.readOnly.of(Boolean(props.readonly)),
      viewModule.EditorView.editable.of(!props.readonly),
    ]),
    viewModule.EditorView.contentAttributes.of({
      'aria-label': 'Вихідний текст',
      'aria-description': 'Щоб вийти з редактора, натисніть Escape, потім Tab.',
    }),
    viewModule.EditorView.updateListener.of((update) => {
      states.set(activeDocumentId, update.state);
      if (update.docChanged && !syncingExternalValue) {
        emit('update:modelValue', update.state.doc.toString(), activeDocumentId);
      }
      if (update.selectionSet || update.docChanged) sendSelection();
      if (update.selectionSet || update.geometryChanged || update.viewportChanged)
        measureComments();
    }),
    viewModule.EditorView.domEventHandlers({
      click(event) {
        const mark =
          event.target instanceof Element ? event.target.closest('[data-annotation-id]') : null;
        if (mark) emit('annotation', Number(mark.getAttribute('data-annotation-id')));
      },
      scroll: measureComments,
    }),
  ];

  const cached = states.get(props.documentId);
  const state = cached
    ? cached
    : loadedStateModule.EditorState.create({
        doc: props.modelValue,
        extensions: baseExtensions,
      });

  view = new viewModule.EditorView({ state, parent: viewport.value });
  view.contentDOM.addEventListener('compositionstart', onCompositionStart);
  view.contentDOM.addEventListener('compositionend', onCompositionEnd);
  activeDocumentId = props.documentId;
  states.set(activeDocumentId, view.state);
  if (cached) dispatchExternalValue(props.modelValue);
  updateAnnotations();
  sendSelection();
  measureComments();
}

function onCompositionStart() {
  composing = true;
  commentButton.value = null;
  emit('composition', true);
}

function onCompositionEnd() {
  composing = false;
  measureComments();
  emit('composition', false);
}

watch(
  () => [props.documentId, props.modelValue, props.resetKey] as const,
  ([documentId, modelValue, resetKey], previous) => {
    if (!view || !modules || !readonlyCompartment) return;

    const previousResetKey = previous?.[2];
    if (previous && resetKey !== previousResetKey && stateModule) {
      states.clear();
      scrollSnapshots.clear();
      activeDocumentId = documentId;
      view.setState(
        stateModule.EditorState.create({ doc: modelValue, extensions: baseExtensions }),
      );
      reconfigureReadonly(Boolean(props.readonly));
      restoreScroll(documentId);
      states.set(activeDocumentId, view.state);
      sendSelection();
      updateAnnotations();
      return;
    }

    if (documentId !== activeDocumentId) {
      states.set(activeDocumentId, view.state);
      scrollSnapshots.set(activeDocumentId, view.scrollSnapshot());
      activeDocumentId = documentId;
      const next = states.get(documentId);
      if (next) {
        view.setState(next);
        reconfigureReadonly(Boolean(props.readonly));
        dispatchExternalValue(modelValue);
        restoreScroll(documentId);
      } else if (stateModule) {
        view.setState(
          stateModule.EditorState.create({ doc: modelValue, extensions: baseExtensions }),
        );
        reconfigureReadonly(Boolean(props.readonly));
        states.set(documentId, view.state);
        restoreScroll(documentId);
      }
      sendSelection();
      updateAnnotations();
      return;
    }

    dispatchExternalValue(modelValue);
  },
);

watch(
  () => props.readonly,
  (readonly) => {
    if (!view || !readonlyCompartment) return;
    reconfigureReadonly(Boolean(readonly));
  },
);

watch(
  [() => props.annotations, () => props.activeAnnotation, () => props.showCommentGutter],
  updateAnnotations,
  { flush: 'post' },
);
watch(
  [
    () => props.canComment,
    () => props.alignComments,
    () => props.annotations,
    () => props.showCommentGutter,
  ],
  measureComments,
  { flush: 'post' },
);

async function focusAt(documentId: number, position: { line: number; character: number } | null) {
  await ready;
  if (destroyed || !view || documentId !== activeDocumentId) return;
  if (position && position.line < view.state.doc.lines) {
    const line = view.state.doc.line(position.line + 1);
    if (position.character <= line.length) {
      view.dispatch({
        selection: { anchor: line.from + position.character },
        scrollIntoView: true,
      });
    }
  }
  view.focus();
}

onMounted(() => {
  ready = initialize();
});
async function reveal(documentId: number, selection: TextSelection) {
  await ready;
  if (destroyed || !view || documentId !== activeDocumentId || selection.to > view.state.doc.length)
    return;
  view.dispatch({
    selection: { anchor: selection.from, head: selection.to },
    scrollIntoView: true,
  });
  view.focus();
}
type SourceCapture = NonNullable<ReturnType<typeof captureSource>>;
function captureSource() {
  if (!view || view.state.readOnly || composing) return;
  const { doc, selection } = view.state;
  return {
    fileId: activeDocumentId,
    doc,
    cursor: selection.main.head,
    position: cursorPosition(doc, selection.main.head),
  };
}

function sameSource(source: SourceCapture, includeCursor = false) {
  return (
    view &&
    !view.state.readOnly &&
    !composing &&
    activeDocumentId === source.fileId &&
    view.state.doc === source.doc &&
    (!includeCursor || view.state.selection.main.head === source.cursor)
  );
}

function applyFormatting(source: SourceCapture, value: unknown) {
  if (!view || !sameSource(source)) return null;
  const edits = readFormatting(value, source.doc);
  if (!edits) throw new Error('Invalid formatting edits');
  const changed = edits.filter(
    (edit) => source.doc.sliceString(edit.from, edit.to) !== edit.insert,
  );
  if (changed.length)
    view.dispatch({ changes: changed, scrollIntoView: true, userEvent: 'input.format' });
  return changed.length > 0;
}

function showCompletions() {
  if (!view || !props.complete || view.state.readOnly || composing) return;
  view.focus();
  startCompletion?.(view);
}

defineExpose({
  focus: () => view?.focus(),
  focusAt,
  reveal,
  captureSource,
  sameSource,
  applyFormatting,
  showCompletions,
});

onBeforeUnmount(() => {
  destroyed = true;
  if (view) {
    states.set(activeDocumentId, view.state);
    view.contentDOM.removeEventListener('compositionstart', onCompositionStart);
    view.contentDOM.removeEventListener('compositionend', onCompositionEnd);
    view.destroy();
  }
  if (composing) emit('composition', false);
});
</script>

<template>
  <div ref="host" class="text-editor">
    <div
      ref="viewport"
      class="text-editor-viewport"
      :class="{ 'text-editor-with-comment-gutter': showCommentGutter && annotations?.length }"
    />
    <div v-if="showCommentGutter && annotations?.length" class="editor-comment-gutter">
      <button
        v-for="marker in gutterButtons"
        :key="marker.line"
        type="button"
        class="file-icon-button editor-gutter-comment"
        :style="{ top: `${marker.y}px`, height: `${marker.height}px` }"
        :aria-label="`Відкрити коментарі до рядка ${marker.line}`"
        @click="emit('gutter-comment', marker.id)"
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          aria-hidden="true"
        >
          <path
            d="M4 4h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H8l-4 3v-3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z M6.5 8h7m-7 3h4"
          />
        </svg>
      </button>
    </div>
    <button
      v-if="commentButton && canComment"
      type="button"
      class="file-icon-button editor-selection-comment"
      aria-label="Додати коментар до виділення"
      aria-keyshortcuts="Control+Alt+M Meta+Alt+M"
      title="Додати коментар до виділення"
      :style="{ left: `${commentButton.x}px`, top: `${commentButton.y}px` }"
      @mousedown.prevent
      @click="emit('comment')"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        aria-hidden="true"
      >
        <path d="M4 4h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H8l-4 3v-3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
        <path d="M7 9h6m-3-3v6" />
      </svg>
    </button>
  </div>
</template>

<style>
.text-editor,
.text-editor-viewport,
.text-editor .cm-editor {
  min-height: 100%;
  height: 100%;
}
.text-editor {
  position: relative;
  --editor-comment-gutter-width: 30px;
}
.text-editor-with-comment-gutter {
  padding-inline-start: var(--editor-comment-gutter-width);
}
.editor-comment-gutter {
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  width: var(--editor-comment-gutter-width);
  overflow: hidden;
  background: var(--color-background);
  pointer-events: none;
}
.editor-comment-gutter .editor-gutter-comment {
  position: absolute;
  inset-inline: 0;
  display: grid;
  place-items: center;
  width: 100%;
  min-width: 0;
  min-height: 0;
  padding: 0;
  transform: translateY(-50%);
  color: var(--color-primary);
  pointer-events: auto;
}
.editor-gutter-comment:focus-visible {
  outline-offset: -2px;
}
.text-editor .editor-selection-comment {
  position: absolute;
  z-index: 2;
  width: 40px;
  height: 40px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  box-shadow: 0 2px 8px #102b4924;
  color: var(--color-primary);
}

.text-editor .cm-editor {
  font: inherit;
}

.text-editor .cm-scroller {
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.text-editor .cm-content {
  padding: 1rem 0;
}
.cm-annotation-mark {
  background: #fff2cc;
  box-shadow: inset 0 -1px #b18428;
  cursor: pointer;
}
.cm-annotation-current {
  background: #ffe49d;
  box-shadow: inset 0 -2px #977222;
}

.text-editor .cm-tooltip.workspace-completions {
  max-width: min(420px, calc(100vw - 24px));
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  color: var(--color-text);
  background: var(--color-surface);
  box-shadow: var(--shadow-dropdown, 0 8px 20px #102b411c);
  overflow: hidden;
}

.text-editor .workspace-completions > ul {
  max-width: 100%;
  max-height: min(190px, 30dvh);
  font: 13px var(--font-code);
}

.text-editor .workspace-completions > ul > li {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 32px;
  padding: 7px 9px;
}

.text-editor .workspace-completions > ul > li[aria-selected='true'] {
  color: var(--color-text);
  background: color-mix(in srgb, var(--color-primary) 11%, var(--color-surface));
  box-shadow: inset 2px 0 var(--color-primary);
}

@media (max-width: 720px) {
  .text-editor .workspace-completions > ul > li {
    min-height: 44px;
    padding-block: 11px;
  }
}
</style>
