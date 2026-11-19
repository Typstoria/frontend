import { afterEach, expect, it, vi } from 'vitest';
import type { Compilation, CompilationApi, StartupCompilation } from './compilation-api';
import { ApiError } from '../../shared/api/client';
import { createCompilationModel } from './compilation-model';

const hash = 'a'.repeat(64);
const job = (status: Compilation['status'] = 'succeeded'): Compilation =>
  ({
    id: 7,
    projectId: 1,
    revisionId: 10,
    proposalId: null,
    candidateVersion: null,
    candidateSnapshotId: null,
    status,
    errorCode: status === 'failed' ? 'TYPST_ERROR' : null,
    inputManifestHash: hash,
    compilerFingerprint: status === 'queued' ? null : hash,
    isCurrent: false,
    artifactAvailable: status === 'succeeded',
    artifactExpiresAt: status === 'succeeded' ? new Date(Date.now() + 60_000).toISOString() : null,
    diagnostics: [],
    createdAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
  }) as Compilation;

function fixture(overrides: Partial<CompilationApi> = {}) {
  const api: CompilationApi = {
    latestPdf: vi.fn(async () => ({ job: job(), revisionNumber: 3 })),
    ensure: vi.fn(async () => ({ job: job('queued'), revisionNumber: 4 })),
    start: vi.fn(async () => job('queued')),
    status: vi.fn(async () => job()),
    pdf: vi.fn(async () => new Blob(['%PDF-'], { type: 'application/pdf' })),
    ...overrides,
  };
  return { api, model: createCompilationModel(api) };
}

const models: ReturnType<typeof createCompilationModel>[] = [];
afterEach(() => {
  models.splice(0).forEach((model) => model.dispose());
  vi.useRealTimers();
});

it('opens the latest accepted PDF revision without ensuring a new compilation', async () => {
  const { api, model } = fixture();
  models.push(model);

  await model.openStartup();

  expect(api.ensure).not.toHaveBeenCalled();
  expect(model.state.revision).toEqual({ id: 10, number: 3 });
  expect(model.state.artifact?.job.id).toBe(7);
});

it('only ensures after an explicit empty latest response and stops on a terminal failure', async () => {
  vi.useFakeTimers();
  const { api, model } = fixture({
    latestPdf: vi.fn(async () => null),
    ensure: vi.fn(async () => ({ job: job('queued'), revisionNumber: 4 })),
    status: vi.fn(async () => job('failed')),
  });
  models.push(model);

  const opening = model.openStartup();
  await vi.runAllTimersAsync();
  await opening;

  expect(api.ensure).toHaveBeenCalledTimes(1);
  expect(api.status).toHaveBeenCalledTimes(1);
  expect(model.state.diagnostics?.items[0]?.message).toContain('Typst');
  expect(model.state.retry).toBeNull();
});

it('does not ensure after a latest-PDF API failure and retries only on user action', async () => {
  const latestPdf = vi.fn().mockRejectedValue(new TypeError('offline'));
  const { api, model } = fixture({ latestPdf });
  models.push(model);

  await model.openStartup();
  expect(api.ensure).not.toHaveBeenCalled();
  expect(model.state.retry).toBe('startup');

  await model.retry();
  expect(latestPdf).toHaveBeenCalledTimes(2);
  expect(api.ensure).not.toHaveBeenCalled();
});

it('ignores a late startup response after disposal', async () => {
  let resolveLatest!: (value: StartupCompilation | null) => void;
  const { api, model } = fixture({
    latestPdf: vi.fn(
      () =>
        new Promise<StartupCompilation | null>((resolve) => {
          resolveLatest = resolve;
        }),
    ),
  });
  models.push(model);
  const opening = model.openStartup();
  model.dispose();
  resolveLatest({ job: job(), revisionNumber: 3 });
  await opening;

  expect(api.pdf).not.toHaveBeenCalled();
  expect(api.ensure).not.toHaveBeenCalled();
  expect(model.state.artifact).toBeNull();
});

it('rechecks once when the PDF expires between lookup and download', async () => {
  vi.useFakeTimers();
  const fresh = { ...job(), id: 8, revisionId: 11, isCurrent: true };
  const { api, model } = fixture({
    latestPdf: vi
      .fn()
      .mockResolvedValueOnce({ job: job(), revisionNumber: 3 })
      .mockResolvedValueOnce(null),
    ensure: vi.fn(async () => ({
      job: {
        ...fresh,
        status: 'queued' as const,
        artifactAvailable: false,
        artifactExpiresAt: null,
      },
      revisionNumber: 4,
    })),
    status: vi.fn(async () => fresh),
    pdf: vi
      .fn()
      .mockRejectedValueOnce(new ApiError(409, 'ARTIFACT_UNAVAILABLE', 'Expired', null))
      .mockResolvedValueOnce(new Blob(['%PDF-'], { type: 'application/pdf' })),
  });
  models.push(model);
  const opening = model.openStartup();
  await vi.advanceTimersByTimeAsync(600);
  await opening;
  expect(api.latestPdf).toHaveBeenCalledTimes(2);
  expect(api.ensure).toHaveBeenCalledTimes(1);
  expect(model.state.artifact?.job.id).toBe(8);
});

it('does not interpret a PDF storage outage as absence', async () => {
  const { api, model } = fixture({
    pdf: vi.fn().mockRejectedValue(new ApiError(503, 'STORAGE_UNAVAILABLE', 'Unavailable', null)),
  });
  models.push(model);
  await model.openStartup();
  expect(api.latestPdf).toHaveBeenCalledTimes(1);
  expect(api.ensure).not.toHaveBeenCalled();
  expect(model.state.retry).toBe('pdf');
});

it('keeps a newer PDF when a compilation finishes for an older revision', async () => {
  const oldJob = { ...job(), id: 8, revisionId: 9 };
  const { model } = fixture({ start: vi.fn(async () => oldJob) });
  models.push(model);
  await model.openStartup();
  const artifact = model.state.artifact;
  await model.start({ id: 9, number: 2 });
  expect(model.state.artifact).toBe(artifact);
});
