import { afterEach, expect, it, vi } from 'vitest';
import { createLivePreview, type PreviewInput } from './live-preview';
import type { LivePreviewCompileRequest, LivePreviewResponse } from './live-preview-protocol';

const file = (fileId: number, path: string, kind: 'text' | 'binary' = 'text') => ({
  fileId,
  path,
  contentKind: kind,
  sizeBytes: 1,
  sha256: 'a'.repeat(64),
  mediaType: kind === 'text' ? 'text/plain' : 'image/png',
});

function fixture() {
  const pending: LivePreviewCompileRequest[] = [];
  const worker = {
    postMessage: (message: LivePreviewCompileRequest) => pending.push(message),
    terminate: vi.fn(),
    onmessage: vi.fn<(event: { data: LivePreviewResponse }) => void>(),
  };
  const text = vi.fn(async (_project, id: number, revisionId: number) => ({
    ...file(id, 'chapter.typ'),
    revisionId,
    content: 'chapter',
  }));
  const download = vi.fn(async () => new Blob([new Uint8Array([42])], { type: 'image/png' }));
  const viewer = createLivePreview(4, { text }, { download }, () => worker as unknown as Worker);
  const input: PreviewInput = {
    revisionId: 8,
    mainFileId: 1,
    tree: [file(1, 'main.typ'), file(2, 'chapter.typ'), file(3, 'image.png', 'binary')],
    texts: new Map([[1, 'initial']]),
  };
  return { viewer, worker, pending, text, download, input };
}

afterEach(() => vi.useRealTimers());

it('loads an exact revision once and sends only the changes for subsequent edits', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  const { viewer, worker, pending, input, text, download } = fixture();
  viewer.request(input);
  await vi.advanceTimersByTimeAsync(60);
  const first = pending[0]!;
  expect(first.changes).toEqual(
    expect.arrayContaining([
      { path: 'main.typ', content: 'initial' },
      { path: 'chapter.typ', content: 'chapter' },
      { path: 'image.png', content: new Uint8Array([42]) },
    ]),
  );
  expect(text).toHaveBeenCalledWith(4, 2, 8, expect.any(AbortSignal));
  expect(download).toHaveBeenCalledWith(4, input.tree[2], 8, expect.any(AbortSignal));

  viewer.request({
    ...input,
    revisionId: 9,
    tree: [input.tree[0]!, { ...input.tree[2]!, path: 'new.png' }],
    texts: new Map([[1, 'new text']]),
  });
  const stale = new Uint8Array([1]);
  worker.onmessage({ data: { type: 'compiled', generation: first.generation, document: stale } });
  expect(viewer.document.value).toBeUndefined();
  await vi.advanceTimersByTimeAsync(60);
  expect(pending[1]?.changes).toEqual(
    expect.arrayContaining([
      { path: 'chapter.typ', content: null },
      { path: 'image.png', content: null },
      { path: 'main.typ', content: 'new text' },
      { path: 'new.png', content: new Uint8Array([42]) },
    ]),
  );
  expect(download).toHaveBeenCalledTimes(1);
  const current = new Uint8Array([2]);
  worker.onmessage({
    data: { type: 'compiled', generation: pending[1]!.generation, document: current },
  });
  expect(viewer.document.value).toBe(current);
  viewer.reset();
  expect(worker.terminate).toHaveBeenCalledOnce();
  expect(viewer.document.value).toBeUndefined();
});

it('retains the last good document on a syntax error and drops it when the worker fails', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  const { viewer, worker, pending, input } = fixture();
  viewer.request(input);
  await vi.advanceTimersByTimeAsync(60);
  const result = new Uint8Array([1]);
  worker.onmessage({
    data: { type: 'compiled', generation: pending[0]!.generation, document: result },
  });
  viewer.request({ ...input, texts: new Map([[1, 'broken']]) });
  await vi.advanceTimersByTimeAsync(60);
  const diagnostics = [{ message: 'Expected expression', severity: 'error' as const }];
  worker.onmessage({
    data: { type: 'failed', reason: 'document', generation: pending[1]!.generation, diagnostics },
  });
  expect(viewer.document.value).toBe(result);
  expect(viewer.diagnostics.value).toEqual(diagnostics);
  viewer.request({ ...input, texts: new Map([[1, 'retry']]) });
  await vi.advanceTimersByTimeAsync(60);
  worker.onmessage({
    data: { type: 'failed', reason: 'unavailable', generation: pending[2]!.generation },
  });
  expect(viewer.document.value).toBeUndefined();
  expect(viewer.diagnostics.value).toEqual([]);
  expect(worker.terminate).toHaveBeenCalledOnce();
  viewer.reset();
});
