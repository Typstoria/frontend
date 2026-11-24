import { ApiError, type RequestOptions } from '../../shared/api/client';
import { isPosition, type Position } from './compilation-diagnostics';
import type { Snapshot } from './workspace-api';

export type OutlineItem = { label: string; position: Position; depth: number };
export type OutlineFile = { fileId: number; path: string; items: OutlineItem[] };
export type OutlineTarget = { fileId: number; position: Position };
export type OutlineNavigation = OutlineTarget & { sha256: string; draft: string | undefined };
type Request = (path: string, options?: RequestOptions) => Promise<unknown>;
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object';
const maxItems = 500;

export function outlineSources(snapshot: Snapshot) {
  return snapshot.tree
    .filter((file) => file.contentKind === 'text' && file.path.endsWith('.typ'))
    .sort((left, right) => {
      const mainFirst =
        Number(right.fileId === snapshot.mainFileId) - Number(left.fileId === snapshot.mainFileId);
      return mainFirst || left.path.localeCompare(right.path);
    });
}

function outlineItems(symbols: unknown): OutlineItem[] {
  const items: OutlineItem[] = [];
  function append(nodes: unknown, depth: number) {
    if (!Array.isArray(nodes) || depth > 12) return;
    for (const node of nodes.slice(0, maxItems)) {
      if (items.length === maxItems) return;
      if (!record(node) || typeof node.name !== 'string' || !node.name.trim()) continue;
      const range =
        node.selectionRange ??
        node.range ??
        (record(node.location) ? node.location.range : undefined);
      if (!record(range) || !isPosition(range.start)) continue;
      items.push({ label: node.name.trim().slice(0, 300), position: range.start, depth });
      append(node.children, depth + 1);
    }
  }
  append(symbols, 0);
  return items;
}

export async function loadSavedOutline(
  request: Request,
  projectId: number,
  snapshot: Snapshot,
  signal: AbortSignal,
): Promise<OutlineFile[]> {
  const value = await request(`/projects/${projectId}/outline`, {
    query: { revisionId: snapshot.revision.id },
    signal,
  });
  if (
    !record(value) ||
    value.projectId !== projectId ||
    value.revisionId !== snapshot.revision.id ||
    !Array.isArray(value.files)
  ) {
    throw new ApiError(200, 'INVALID_RESPONSE', 'Не вдалося прочитати структуру документа.', null);
  }
  const files = new Map(value.files.filter(record).map((file) => [file.fileId, file]));
  return outlineSources(snapshot).map(({ fileId, path }) => {
    const file = files.get(fileId);
    return { fileId, path, items: file?.path === path ? outlineItems(file.symbols) : [] };
  });
}
