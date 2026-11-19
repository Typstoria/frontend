import { afterEach, expect, it, vi } from 'vitest';
import { ApiError } from '../../shared/api/client';
import { createWorkspaceModel } from './workspace-model';
import { createWorkspaceApi } from './workspace-api';
import type { Snapshot, SaveResult, WorkspaceApi } from './workspace-api';
import { structureError } from './file-structure';

const file = (fileId: number, path: string) => ({
  fileId,
  path,
  contentKind: 'text' as const,
  sha256: 'a'.repeat(64),
  sizeBytes: 0,
  mediaType: 'text/plain',
});
const snapshot = (
  id = 10,
  tree = [file(1, 'main.typ'), file(2, 'notes.typ')],
  mainFileId = 1,
): Snapshot => ({
  project: {
    id: 1,
    title: 'Files',
    currentRevisionId: id,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  revision: {
    id,
    number: id,
    parentRevisionId: null,
    createdAt: '2026-01-01',
    commitSha: null,
    manifestHash: 'a'.repeat(64),
    historySyncStatus: 'pending',
  },
  tree,
  mainFileId,
  contextText: '',
});
const result = (revisionId = 11): SaveResult => ({
  projectId: 1,
  revisionId,
  revisionNumber: revisionId,
  mainFileId: 1,
  manifestHash: 'b'.repeat(64),
  createdFiles: [],
  historySyncStatus: 'pending',
});
const created = () => ({ ...result(), createdFiles: [{ fileId: 3, path: 'chapter.typ' }] });
const models: ReturnType<typeof createWorkspaceModel>[] = [];
function fixture() {
  const api: WorkspaceApi = {
    state: vi.fn(async (_id, _signal, revisionId) =>
      revisionId
        ? snapshot(revisionId, [file(1, 'main.typ'), file(2, 'notes.typ'), file(3, 'chapter.typ')])
        : snapshot(),
    ),
    text: vi.fn(async (_id, fileId, revisionId) => ({
      ...file(fileId, fileId === 1 ? 'main.typ' : 'notes.typ'),
      revisionId,
      content: `base${fileId}`,
    })),
    save: vi.fn(async () => created()),
  };
  const model = createWorkspaceModel(1, api);
  models.push(model);
  return { api, model, state: model.state };
}
afterEach(() => {
  models.splice(0).forEach((model) => model.dispose());
  vi.useRealTimers();
});

it('creates a file and dirty texts in one batch, using returned IDs and the exact accepted snapshot', async () => {
  const { api, model, state } = fixture();
  await model.load();
  model.edit(1, 'local text');
  expect(await model.mutate([{ type: 'createFile', path: 'chapter.typ', content: '' }])).toBe(true);
  expect(vi.mocked(api.save).mock.calls[0]![1]).toEqual({
    baseRevisionId: 10,
    operations: [
      { type: 'updateText', fileId: 1, content: 'local text' },
      { type: 'createFile', path: 'chapter.typ', content: '' },
    ],
  });
  expect(api.state).toHaveBeenLastCalledWith(1, expect.any(AbortSignal), 11);
  expect(state.selectedId).toBe(3);
  expect(state.files[1]).toEqual({ base: 'local text', content: 'local text' });
  expect(state.files[3]).toEqual({ base: '', content: '' });
  expect(model.atRisk.value).toBe(false);
});

it('keeps a lost create immutable and preserves newer edits when its replay succeeds', async () => {
  vi.useFakeTimers();
  const { api, model, state } = fixture();
  await model.load();
  vi.mocked(api.save).mockRejectedValueOnce(new TypeError('offline'));
  model.edit(1, 'sent');
  expect(await model.mutate([{ type: 'createFile', path: 'chapter.typ', content: '' }])).toBe(
    false,
  );
  const attempt = vi.mocked(api.save).mock.calls[0]!;
  expect(await model.mutate([{ type: 'renameFile', fileId: 1, path: 'other.typ' }])).toBe(false);
  model.edit(1, 'later');
  await vi.advanceTimersByTimeAsync(2000);
  expect(api.save).toHaveBeenCalledOnce();
  await model.save();
  expect(vi.mocked(api.save).mock.calls[1]![1]).toEqual(attempt[1]);
  expect(vi.mocked(api.save).mock.calls[1]![2]).toBe(attempt[2]);
  expect(state.files[1]).toEqual({ base: 'sent', content: 'later' });
  expect(state.status).toBe('dirty');
});

it('retries only the read after a committed structural save and keeps that phase across reauthentication', async () => {
  const { api, model, state } = fixture();
  await model.load();
  vi.mocked(api.state).mockRejectedValueOnce(new TypeError('failed read'));
  await model.mutate([{ type: 'createFile', path: 'chapter.typ', content: '' }]);
  expect(state.status).toBe('refresh_failed');
  expect(state.pending!.result!.revisionId).toBe(11);
  const recovery = model.recover()!;
  model.dispose();
  const next = fixture();
  await next.model.load(recovery);
  expect(next.state.status).toBe('refresh_failed');
  await next.model.save();
  expect(next.api.save).not.toHaveBeenCalled();
  expect(next.state.files[3]).toEqual({ base: '', content: '' });
  expect(next.state.status).toBe('clean');
});

it('requires replacement of a deleted main file and deletes its dirty text only after success', async () => {
  const { api, model, state } = fixture();
  await model.load();
  model.edit(1, 'local main');
  await model.mutate([{ type: 'deleteFile', fileId: 1 }]);
  expect(api.save).not.toHaveBeenCalled();
  expect(state.files[1]!.content).toBe('local main');
  model.cancelStructure();
  vi.mocked(api.save).mockResolvedValueOnce({ ...result(), mainFileId: 2 });
  vi.mocked(api.state).mockResolvedValueOnce(snapshot(11, [file(2, 'notes.typ')], 2));
  await model.mutate([
    { type: 'deleteFile', fileId: 1 },
    { type: 'setEntrypoint', path: 'notes.typ' },
  ]);
  expect(vi.mocked(api.save).mock.calls[0]![1].operations).toEqual([
    { type: 'deleteFile', fileId: 1 },
    { type: 'setEntrypoint', path: 'notes.typ' },
  ]);
  expect(state.files[1]).toBeUndefined();
  expect(state.selectedId).toBe(2);
  expect(state.snapshot!.mainFileId).toBe(2);
});

it('requires a new deletion confirmation after someone adds a file to the folder', async () => {
  const { api, model, state } = fixture();
  const before = { ...snapshot(), directories: ['drafts'] };
  const current = {
    ...snapshot(11),
    tree: [...before.tree, file(3, 'drafts/new.typ')],
    directories: ['drafts'],
  };
  vi.mocked(api.state).mockResolvedValueOnce(before).mockResolvedValueOnce(current);
  vi.mocked(api.save).mockRejectedValueOnce(new ApiError(409, 'REVISION_CONFLICT', '', null));
  await model.load();
  await model.mutate([{ type: 'deleteDirectory', path: 'drafts' }]);
  await model.compare();
  expect(state.conflict?.structure[0]).toMatchObject({
    include: false,
    error: 'Вміст папки змінився на сервері. Перегляньте його перед видаленням.',
  });
});

it('does not permit new edits in a pending deletion and retains the text for recovery on failure', async () => {
  const { api, model, state } = fixture();
  await model.load();
  await model.select(2);
  model.edit(2, 'unsaved');
  vi.mocked(api.save).mockRejectedValueOnce(new TypeError('lost'));
  await model.mutate([{ type: 'deleteFile', fileId: 2 }]);
  model.edit(2, 'would be lost');
  expect(state.files[2]!.content).toBe('unsaved');
  expect(model.recover()!.files[2]!.content).toBe('unsaved');
  model.cancelStructure();
  expect(state.structure).toHaveLength(1);
});

it('groups structural conflict intentions and never reapplies an unchecked destructive action', async () => {
  vi.useFakeTimers();
  const { api, model, state } = fixture();
  await model.load();
  vi.mocked(api.save).mockRejectedValueOnce(new ApiError(409, 'REVISION_CONFLICT', '', null));
  await model.mutate([
    { type: 'deleteFile', fileId: 1 },
    { type: 'setEntrypoint', path: 'notes.typ' },
  ]);
  vi.mocked(api.state).mockResolvedValueOnce(snapshot(12));
  await model.compare();
  expect(state.conflict!.structure).toHaveLength(1);
  expect(state.conflict!.structure[0]!.operations).toHaveLength(2);
  expect(state.conflict!.structure[0]!.include).toBe(false);
  await model.resolve();
  await vi.advanceTimersByTimeAsync(2000);
  expect(api.save).toHaveBeenCalledOnce();
  expect(state.snapshot!.mainFileId).toBe(1);
  expect(state.structure).toEqual([]);
});

it('explicitly rebases a reviewed structural intention and rejects remote collisions before replay', async () => {
  vi.useFakeTimers();
  const { api, model, state } = fixture();
  await model.load();
  vi.mocked(api.save).mockRejectedValueOnce(new ApiError(409, 'REVISION_CONFLICT', '', null));
  await model.mutate([{ type: 'createFile', path: 'chapter.typ', content: '' }]);
  vi.mocked(api.state).mockResolvedValueOnce(snapshot(12));
  await model.compare();
  state.conflict!.structure[0]!.include = true;
  await model.resolve();
  await vi.advanceTimersByTimeAsync(1000);
  expect(vi.mocked(api.save).mock.calls[1]![1].baseRevisionId).toBe(12);
  expect(
    structureError([{ type: 'createFile', path: 'notes.typ', content: '' }], snapshot()),
  ).toContain('існує');
  expect(
    structureError([{ type: 'renameFile', fileId: 1, path: 'main.TYP' }], snapshot()),
  ).toContain('.typ');
});

it('validates created-file mappings and revision-bound canonical reads', async () => {
  const request = vi.fn();
  const api = createWorkspaceApi(request);
  const signal = new AbortController().signal;
  const body = {
    baseRevisionId: 10,
    operations: [{ type: 'createFile' as const, path: 'chapter.typ', content: '' }],
  };
  request.mockResolvedValueOnce(created());
  await expect(api.save(1, body, 'key', signal)).resolves.toMatchObject({
    createdFiles: [{ fileId: 3, path: 'chapter.typ' }],
  });
  request.mockResolvedValueOnce({ ...created(), createdFiles: [{ fileId: 3, path: 'wrong.typ' }] });
  await expect(api.save(1, body, 'key', signal)).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  });
  request.mockResolvedValueOnce(snapshot(12));
  await expect(api.state(1, signal, 11)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
});

it('does not automatically replay a definitively rejected structural intention after reauthentication', async () => {
  vi.useFakeTimers();
  const { api, model, state } = fixture();
  await model.load();
  vi.mocked(api.save).mockRejectedValueOnce(new ApiError(429, 'RATE_LIMITED', '', null));
  await model.mutate([{ type: 'deleteFile', fileId: 2 }]);
  expect(state.status).toBe('failed');
  const recovery = model.recover()!;
  model.dispose();
  const next = fixture();
  await next.model.load(recovery);
  expect(next.state.status).toBe('failed');
  expect(next.state.saveError).toBeTruthy();
  next.model.edit(1, 'new text after login');
  await vi.advanceTimersByTimeAsync(5000);
  expect(next.api.save).not.toHaveBeenCalled();
  next.model.cancelStructure();
  await vi.advanceTimersByTimeAsync(1000);
  expect(vi.mocked(next.api.save).mock.calls[0]![1].operations).toEqual([
    { type: 'updateText', fileId: 1, content: 'new text after login' },
  ]);
});

it('rejects reentrant structure submission while a replacement file is still loading', async () => {
  const { api, model, state } = fixture();
  await model.load();
  let release!: (text: Awaited<ReturnType<WorkspaceApi['text']>>) => void;
  vi.mocked(api.text).mockReturnValueOnce(
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  vi.mocked(api.save).mockResolvedValueOnce({ ...result(), mainFileId: 2 });
  vi.mocked(api.state).mockResolvedValueOnce(snapshot(11, [file(2, 'notes.typ')], 2));
  const pending = model.mutate([
    { type: 'deleteFile', fileId: 1 },
    { type: 'setEntrypoint', path: 'notes.typ' },
  ]);
  await vi.waitFor(() => expect(state.fileLoading).toBe(true));
  expect(await model.mutate([{ type: 'deleteFile', fileId: 1 }])).toBe(false);
  expect(api.save).toHaveBeenCalledOnce();
  release({ ...file(2, 'notes.typ'), revisionId: 11, content: 'replacement' });
  expect(await pending).toBe(true);
  expect(state.structure).toEqual([]);
  expect(state.status).toBe('clean');
});
