import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../shared/api/client';
import { createWorkspaceModel } from './workspace-model';
import { createWorkspaceApi } from './workspace-api';
import type { SaveResult, Snapshot, WorkspaceApi } from './workspace-api';

const meta = (fileId: number) => ({
  fileId,
  path: `${fileId}.typ`,
  contentKind: 'text' as const,
  sha256: 'a'.repeat(64),
  sizeBytes: 0,
  mediaType: 'text/plain',
});
const snapshot = (revision = 10): Snapshot => ({
  project: {
    id: 1,
    title: 'Документ',
    currentRevisionId: revision,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  revision: {
    id: revision,
    number: revision,
    parentRevisionId: null,
    commitSha: null,
    historySyncStatus: 'pending',
    manifestHash: 'a'.repeat(64),
    createdAt: '2026-01-01T00:00:00Z',
  },
  mainFileId: 1,
  contextText: '',
  tree: [meta(1), meta(2)],
});
const result = (revisionId = 11): SaveResult => ({
  projectId: 1,
  revisionId,
  revisionNumber: revisionId,
  mainFileId: 1,
  createdFiles: [],
  manifestHash: 'b'.repeat(64),
  historySyncStatus: 'pending',
});
function fixture() {
  const api: WorkspaceApi = {
    state: vi.fn(async () => snapshot()),
    text: vi.fn(async (_p, fileId, revisionId) => ({
      ...meta(fileId),
      revisionId,
      content: `base${fileId}`,
    })),
    save: vi.fn(async () => result()),
  };
  const model = createWorkspaceModel(1, api);
  models.push(model);
  return { api, model, state: model.state };
}
const models: ReturnType<typeof createWorkspaceModel>[] = [];
afterEach(() => {
  models.splice(0).forEach((m) => m.dispose());
  vi.useRealTimers();
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { resolve, promise };
}

describe('workspace autosave', () => {
  it('keeps a newer context draft when an atomic context and text save finishes', async () => {
    const { model, api, state } = fixture();
    await model.load();
    const response = deferred<SaveResult>();
    vi.mocked(api.save).mockReturnValueOnce(response.promise);
    model.edit(1, 'changed file');
    model.editContext('  context 🙂\n');
    const saving = model.save();
    model.editContext('later');
    response.resolve(result());
    await saving;
    expect(vi.mocked(api.save).mock.calls[0]?.[1].operations).toEqual([
      { type: 'updateText', fileId: 1, content: 'changed file' },
      { type: 'updateContext', content: '  context 🙂\n' },
    ]);
    expect(state.snapshot?.contextText).toBe('  context 🙂\n');
    expect(state.contextText).toBe('later');
    expect(model.recover()?.contextText).toBe('later');
  });

  it('keeps dirty context when a staged resource expires during attachment', async () => {
    const { model, api, state } = fixture();
    await model.load();
    model.editContext('unsaved context');
    vi.mocked(api.save).mockRejectedValueOnce(new ApiError(409, 'UPLOAD_EXPIRED', '', null));
    expect(await model.mutate([{ type: 'attachFile', path: 'figure.png', uploadId: 7 }])).toBe(
      false,
    );
    expect(state.status).toBe('failed');
    expect(state.pending).toBeNull();
    expect(state.structure).toEqual([]);
    expect(state.contextText).toBe('unsaved context');
    expect(model.atRisk.value).toBe(true);
  });
  it('ignores a late initial snapshot after leaving the workspace', async () => {
    const { model, api, state } = fixture();
    const response = deferred<Snapshot>();
    vi.mocked(api.state).mockReturnValueOnce(response.promise);
    const loading = model.load();
    model.dispose();
    response.resolve(snapshot());
    await loading;
    expect(state.snapshot).toBeNull();
    expect(api.text).not.toHaveBeenCalled();
  });
  it('debounces edits, waits for IME and atomically saves all dirty files', async () => {
    vi.useFakeTimers();
    const { model, api, state } = fixture();
    await model.load();
    await model.select(2);
    model.composition(true);
    model.edit(1, 'Українська 🧪');
    model.edit(2, 'chapter');
    await vi.advanceTimersByTimeAsync(2000);
    expect(api.save).not.toHaveBeenCalled();
    model.composition(false);
    await vi.advanceTimersByTimeAsync(999);
    expect(api.save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(api.save).toHaveBeenCalledOnce();
    expect(vi.mocked(api.save).mock.calls[0]![1]).toEqual({
      baseRevisionId: 10,
      operations: [
        { type: 'updateText', fileId: 1, content: 'Українська 🧪' },
        { type: 'updateText', fileId: 2, content: 'chapter' },
      ],
    });
    expect(state.status).toBe('clean');
  });
  it('serializes saves and keeps later edits dirty, including undo back to the old base', async () => {
    vi.useFakeTimers();
    const { api, model, state } = fixture();
    await model.load();
    const pending = deferred<SaveResult>();
    vi.mocked(api.save).mockReturnValueOnce(pending.promise);
    model.edit(1, 'sent');
    const saving = model.save();
    model.edit(1, 'base1');
    expect(model.save()).toBe(saving);
    expect(api.save).toHaveBeenCalledOnce();
    expect(model.atRisk.value).toBe(true);
    pending.resolve(result());
    await saving;
    expect(state.files[1]).toEqual({ base: 'sent', content: 'base1' });
    expect(state.status).toBe('dirty');
    await vi.advanceTimersByTimeAsync(1000);
    expect(vi.mocked(api.save).mock.calls[1]![1]).toEqual({
      baseRevisionId: 11,
      operations: [{ type: 'updateText', fileId: 1, content: 'base1' }],
    });
  });
  it('freezes an unknown attempt and retries its exact payload/key before sending new edits', async () => {
    vi.useFakeTimers();
    const { api, model, state } = fixture();
    await model.load();
    vi.mocked(api.save).mockRejectedValueOnce(new TypeError('offline'));
    model.edit(1, 'first');
    await model.save();
    const first = vi.mocked(api.save).mock.calls[0]!;
    model.edit(1, 'later');
    await vi.advanceTimersByTimeAsync(5000);
    expect(api.save).toHaveBeenCalledOnce();
    expect(state.status).toBe('outcome_unknown');
    await model.save();
    const retry = vi.mocked(api.save).mock.calls[1]!;
    expect(retry[1]).toEqual(first[1]);
    expect(retry[2]).toBe(first[2]);
    expect(state.files[1]).toEqual({ base: 'first', content: 'later' });
    await vi.advanceTimersByTimeAsync(1000);
    expect(vi.mocked(api.save).mock.calls[2]![2]).not.toBe(first[2]);
    expect(vi.mocked(api.save).mock.calls[2]![1].operations[0]).toMatchObject({
      type: 'updateText',
      content: 'later',
    });
  });
  it('keeps base/local on conflict and requires explicit merging against the remote snapshot', async () => {
    vi.useFakeTimers();
    const { api, model, state } = fixture();
    await model.load();
    vi.mocked(api.save).mockRejectedValueOnce(
      new ApiError(409, 'REVISION_CONFLICT', 'internal', 'secret'),
    );
    model.edit(1, 'local');
    await model.save();
    vi.mocked(api.state).mockResolvedValueOnce(snapshot(12));
    vi.mocked(api.text).mockImplementationOnce(async (_p, fileId, revisionId) => ({
      ...meta(fileId),
      revisionId,
      content: 'remote',
    }));
    await model.compare();
    expect(state.files[1]).toEqual({ base: 'base1', content: 'local' });
    expect(state.conflict!.files[0]).toMatchObject({
      base: 'base1',
      local: 'local',
      remote: 'remote',
    });
    await vi.advanceTimersByTimeAsync(5000);
    expect(api.save).toHaveBeenCalledOnce();
    state.conflict!.files[0]!.merged = 'merged';
    await model.resolve();
    expect(state.files[1]).toEqual({ base: 'remote', content: 'merged' });
    await vi.advanceTimersByTimeAsync(1000);
    expect(vi.mocked(api.save).mock.calls[1]![1].baseRevisionId).toBe(12);
  });
  it('does not overwrite remote deletion or binary replacement during conflict resolution', async () => {
    const { api, model, state } = fixture();
    await model.load();
    await model.select(2);
    vi.mocked(api.save).mockRejectedValueOnce(new ApiError(409, 'REVISION_CONFLICT', '', null));
    model.edit(2, 'keep this locally');
    await model.save();
    const remote = snapshot(12);
    remote.tree = [meta(1)];
    vi.mocked(api.state).mockResolvedValueOnce(remote);
    await model.compare();
    expect(state.conflict!.files[0]).toMatchObject({ local: 'keep this locally', remote: null });
    await model.resolve();
    expect(state.files[2]).toBeUndefined();
    expect(state.status).toBe('clean');
  });
  it('preserves manual merges through reauthentication and prevents a second comparison from replacing them', async () => {
    const { api, model, state } = fixture();
    await model.load();
    vi.mocked(api.save).mockRejectedValueOnce(new ApiError(409, 'REVISION_CONFLICT', '', null));
    model.edit(1, 'local');
    await model.save();
    await model.compare();
    state.conflict!.files[0]!.merged = 'manual merge';
    await model.compare();
    expect(api.state).toHaveBeenCalledTimes(2);
    expect(state.conflict!.files[0]!.merged).toBe('manual merge');
    const recovery = model.recover()!;
    model.dispose();
    const next = fixture();
    await next.model.load(recovery);
    expect(next.state.saveError).toBeTruthy();
    expect(next.state.conflict!.files[0]!.merged).toBe('manual merge');
    await next.model.resolve();
    expect(next.state.files[1]!.content).toBe('manual merge');
  });
  it('retains uncertain attempts for same-tab reauthentication and ignores late responses after disposal', async () => {
    const { api, model, state } = fixture();
    await model.load();
    const pending = deferred<SaveResult>();
    vi.mocked(api.save).mockReturnValueOnce(pending.promise);
    model.edit(1, 'unsaved');
    const saving = model.save();
    const recovery = model.recover()!;
    model.dispose();
    pending.resolve(result());
    await saving;
    expect(state.snapshot!.revision.id).toBe(10);
    const next = fixture();
    await next.model.load(recovery);
    expect(next.state.status).toBe('outcome_unknown');
    expect(next.state.files[1]!.content).toBe('unsaved');
    await next.model.save();
    expect(vi.mocked(next.api.save).mock.calls[0]![2]).toBe(recovery.pending!.key);
  });
  it('rejects oversized UTF-8 text locally and validates snapshot/file/save identities at the boundary', async () => {
    const { model, api, state } = fixture();
    await model.load();
    model.edit(1, 'я'.repeat(524289));
    await model.save();
    expect(api.save).not.toHaveBeenCalled();
    expect(state.status).toBe('failed');
    const request = vi.fn();
    const boundary = createWorkspaceApi(request);
    request.mockResolvedValueOnce({ ...snapshot(), tree: [meta(1), meta(1)] });
    await expect(boundary.state(1, new AbortController().signal)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
    request.mockResolvedValueOnce({ ...meta(1), revisionId: 20, content: 'wrong revision' });
    await expect(boundary.text(1, 1, 10, new AbortController().signal)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
    request.mockResolvedValueOnce({ ...result(), projectId: 2 });
    await expect(
      boundary.save(1, { baseRevisionId: 10, operations: [] }, 'key', new AbortController().signal),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});
