import type { TextAnchor } from './annotation-api';

export type TextSelection = { from: number; to: number };

function rawOffset(source: string, editorOffset: number) {
  let result = editorOffset;
  for (const match of source.matchAll(/\r\n/g)) {
    if (match.index >= result) break;
    result++;
  }
  return result;
}

function splitsPair(source: string, index: number) {
  return (
    /[\uD800-\uDBFF]/u.test(source[index - 1] ?? '') && /[\uDC00-\uDFFF]/u.test(source[index] ?? '')
  );
}

export function createTextAnchor(
  source: string,
  fileId: number,
  selection: TextSelection,
): TextAnchor | null {
  const start = rawOffset(source, selection.from);
  const end = rawOffset(source, selection.to);
  if (
    start < 0 ||
    end <= start ||
    end > source.length ||
    end > 1048576 ||
    end - start > 4000 ||
    splitsPair(source, start) ||
    splitsPair(source, end)
  )
    return null;
  const quote = source.slice(start, end);
  if (quote.length > 2000 && Array.from(quote).length > 2000) return null;
  const prefixStart = Math.max(0, start - 80);
  const suffixEnd = Math.min(source.length, end + 80);
  return {
    fileId,
    start,
    end,
    quote,
    prefix: source.slice(prefixStart + Number(splitsPair(source, prefixStart)), start),
    suffix: source.slice(end, suffixEnd - Number(splitsPair(source, suffixEnd))),
  };
}

export function editorSelection(
  source: string,
  start: number,
  end: number,
  quote: string,
): TextSelection | null {
  if (start < 0 || end > source.length || source.slice(start, end) !== quote) return null;
  const from = source.slice(0, start).replace(/\r\n/g, '\n').length;
  return { from, to: from + quote.replace(/\r\n/g, '\n').length };
}
