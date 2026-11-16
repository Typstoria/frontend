import { expect, it, vi } from 'vitest';
import { createCompilationApi } from './compilation-api';

const hash = 'a'.repeat(64);
const job = (status: 'queued' | 'succeeded') => ({
  id: 7,
  projectId: 1,
  revisionId: 12,
  proposalId: null,
  candidateVersion: null,
  candidateSnapshotId: null,
  status,
  errorCode: null,
  inputManifestHash: hash,
  compilerFingerprint: status === 'queued' ? null : hash,
  artifactAvailable: status === 'succeeded',
  artifactExpiresAt: status === 'succeeded' ? new Date(Date.now() + 60_000).toISOString() : null,
  diagnostics: [],
  createdAt: new Date().toISOString(),
  startedAt: null,
  finishedAt: null,
  isCurrent: false,
});

it('parses an empty latest-PDF response and sends ensure without a body', async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce({ job: null, revisionNumber: null })
    .mockResolvedValueOnce({ job: job('queued'), revisionNumber: 13 });
  const api = createCompilationApi(1, request);
  const signal = new AbortController().signal;

  expect(await api.latestPdf(signal)).toBeNull();
  expect(await api.ensure(signal)).toMatchObject({
    revisionNumber: 13,
    job: { id: 7, revisionId: 12, status: 'queued' },
  });
  expect(request).toHaveBeenNthCalledWith(1, '/projects/1/compilations/latest-pdf', { signal });
  expect(request).toHaveBeenNthCalledWith(2, '/projects/1/compilations/ensure', {
    method: 'POST',
    signal,
  });
});

it('rejects a proposal or a non-successful latest PDF as an invalid response', async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce({ job: { ...job('succeeded'), proposalId: 9 }, revisionNumber: 13 })
    .mockResolvedValueOnce({ job: job('queued'), revisionNumber: 13 });
  const api = createCompilationApi(1, request);
  const signal = new AbortController().signal;

  await expect(api.latestPdf(signal)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  await expect(api.latestPdf(signal)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
});
