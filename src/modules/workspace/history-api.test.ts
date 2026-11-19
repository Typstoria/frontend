import { expect, it, vi } from 'vitest';
import { createHistoryApi } from './history-api';

const diff = (directories?: { added: string[]; deleted: string[] }) => ({
  fromRevisionId: 1,
  toRevisionId: 2,
  fromHistorySyncStatus: 'ready',
  toHistorySyncStatus: 'ready',
  files: [],
  ...(directories === undefined ? {} : { directories }),
  context: { changed: false, patch: null, patchOmittedReason: null },
  entrypoint: { changed: false, beforeFileId: 1, afterFileId: 1 },
});

it('preserves folder-only changes in a revision diff', async () => {
  const request = vi.fn().mockResolvedValue(diff({ added: ['chapters'], deleted: [] }));
  const result = await createHistoryApi(request).diff(7, 1, 2, new AbortController().signal);

  expect(result.directories).toEqual({ added: ['chapters'], deleted: [] });
});

it('accepts older revision diffs that do not include directories', async () => {
  const request = vi.fn().mockResolvedValue(diff());
  const result = await createHistoryApi(request).diff(7, 1, 2, new AbortController().signal);

  expect(result.directories).toEqual({ added: [], deleted: [] });
});
