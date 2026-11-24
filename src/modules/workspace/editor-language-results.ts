import type { Text } from '@codemirror/state';
import { isPosition, type Position } from './compilation-diagnostics';
import { isRecord } from './editor-language-session';

export type SourceEdit = { from: number; to: number; insert: string };
export type Definition = { fileId: number; position: Position };
export type SuggestedEdit = {
  label: string;
  detail: string | undefined;
  type: string | undefined;
  edit: SourceEdit;
  extra: SourceEdit[];
  snippet: boolean;
};
const kinds: Record<number, string> = {
  2: 'method',
  3: 'function',
  4: 'class',
  5: 'property',
  6: 'variable',
  7: 'class',
  9: 'namespace',
  10: 'property',
  13: 'enum',
  14: 'keyword',
  15: 'text',
  21: 'constant',
};

export function cursorPosition(doc: Text, offset: number): Position {
  const line = doc.lineAt(offset);
  return { line: line.number - 1, character: offset - line.from };
}

function offset(doc: Text, value: unknown) {
  if (!isPosition(value) || value.line >= doc.lines) return;
  const line = doc.line(value.line + 1);
  const index = value.character;
  if (
    index > line.length ||
    (/[\uD800-\uDBFF]/u.test(line.text[index - 1] ?? '') &&
      /[\uDC00-\uDFFF]/u.test(line.text[index] ?? ''))
  )
    return;
  return line.from + index;
}

function readEdit(doc: Text, range: unknown, insert: unknown): SourceEdit | undefined {
  if (
    !isRecord(range) ||
    typeof insert !== 'string' ||
    insert.length > 1_048_576 ||
    insert.includes('\0') ||
    /[\uD800-\uDFFF]/u.test(insert)
  )
    return;
  const from = offset(doc, range.start);
  const to = offset(doc, range.end);
  if (from !== undefined && to !== undefined && from <= to) return { from, to, insert };
}

function orderedEdits(edits: SourceEdit[]) {
  edits.sort((a, b) => a.from - b.from || a.to - b.to);
  return edits.every((edit, index) => {
    const previous = edits[index - 1];
    return !previous || (previous.from < edit.from && previous.to <= edit.from);
  });
}

export function readFormatting(value: unknown, doc: Text): SourceEdit[] | null {
  if (value === null) return [];
  if (!Array.isArray(value) || value.length > 10_000) return null;
  const edits: SourceEdit[] = [];
  for (const item of value) {
    if (!isRecord(item)) return null;
    const edit = readEdit(doc, item.range, item.newText);
    if (!edit) return null;
    edits.push(edit);
  }
  return orderedEdits(edits) ? edits : null;
}

export function readCompletions(
  value: unknown,
  doc: Text,
  from: number,
  to: number,
): SuggestedEdit[] {
  const list = isRecord(value) ? value.items : value;
  if (!Array.isArray(list)) return [];
  const defaults = isRecord(value) && isRecord(value.itemDefaults) ? value.itemDefaults : {};
  const prefix = doc.sliceString(from, to).toLowerCase();
  const options: (SuggestedEdit & { rank: number; prefixLength: number; sortText: string })[] = [];
  for (const item of list.slice(0, 200)) {
    if (!isRecord(item) || typeof item.label !== 'string' || !item.label || item.label.length > 300)
      continue;
    const explicitEdit = isRecord(item.textEdit) ? item.textEdit : undefined;
    const range =
      explicitEdit?.range ??
      explicitEdit?.replace ??
      (isRecord(defaults.editRange)
        ? (defaults.editRange.replace ?? defaults.editRange)
        : undefined);
    const insert = explicitEdit?.newText ?? item.textEditText ?? item.insertText ?? item.label;
    const fallbackRange = { start: cursorPosition(doc, from), end: cursorPosition(doc, to) };
    const edit = readEdit(doc, range ?? fallbackRange, insert);
    const extra =
      item.additionalTextEdits === undefined ? [] : readFormatting(item.additionalTextEdits, doc);
    if (!edit || !extra || edit.from > to || edit.to < to || !orderedEdits([edit, ...extra]))
      continue;
    const label = (
      typeof item.filterText === 'string' ? item.filterText : item.label
    ).toLowerCase();
    const startsWithPrefix = !!prefix && label.startsWith(prefix);
    options.push({
      rank: startsWithPrefix ? 0 : prefix && label.includes(prefix) ? 1 : 2,
      prefixLength: startsWithPrefix ? label.length : 0,
      sortText: typeof item.sortText === 'string' ? item.sortText : '',
      label: item.label,
      detail: typeof item.detail === 'string' ? item.detail.slice(0, 180) : undefined,
      type: typeof item.kind === 'number' ? kinds[item.kind] : undefined,
      edit,
      extra,
      snippet: (item.insertTextFormat ?? defaults.insertTextFormat) === 2,
    });
  }
  return options.sort(
    (a, b) =>
      a.rank - b.rank || a.prefixLength - b.prefixLength || a.sortText.localeCompare(b.sortText),
  );
}

export function readDefinitions(value: unknown, files: ReadonlyMap<string, number>): Definition[] {
  const items = Array.isArray(value) ? value : [value];
  const results: Definition[] = [];
  const added = new Set<string>();
  for (const item of items.slice(0, 50)) {
    if (!isRecord(item)) continue;
    const uri = item.targetUri ?? item.uri;
    const range = item.targetSelectionRange ?? item.targetRange ?? item.range;
    const fileId = typeof uri === 'string' ? files.get(uri) : undefined;
    if (fileId === undefined || !isRecord(range) || !isPosition(range.start)) continue;
    const key = `${fileId}:${range.start.line}:${range.start.character}`;
    if (added.has(key)) continue;
    added.add(key);
    results.push({ fileId, position: range.start });
  }
  return results;
}
