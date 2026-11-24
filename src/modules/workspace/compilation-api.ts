import { ApiError, type RequestOptions } from '../../shared/api/client';
import type { components } from '../../shared/api/schema';
import { validId } from './workspace-api';
import { isDiagnostic } from './compilation-diagnostics';
export type { Diagnostic } from './compilation-diagnostics';

// This workspace compiles accepted revisions; proposal previews use a separate flow.
export type Compilation = components['schemas']['CompilationDto'] & { revisionId: number };
export type StartupCompilation = { job: Compilation; revisionNumber: number };
type Request = (path: string, options?: Omit<RequestOptions, 'accessToken'>) => Promise<unknown>;
const statuses = ['queued', 'running', 'succeeded', 'failed', 'timed_out', 'cancelled'];
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const date = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v));
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);

function invalid(): never {
  throw new ApiError(200, 'INVALID_RESPONSE', 'Некоректна відповідь сервера.', null);
}

function parseJob(value: unknown, projectId: number, revisionId: number, jobId?: number) {
  if (
    !record(value) ||
    value.projectId !== projectId ||
    value.revisionId !== revisionId ||
    !validId(value.id) ||
    (jobId !== undefined && value.id !== jobId) ||
    typeof value.status !== 'string' ||
    !statuses.includes(value.status) ||
    !(value.errorCode === null || typeof value.errorCode === 'string') ||
    !hash(value.inputManifestHash) ||
    !(value.compilerFingerprint === null || hash(value.compilerFingerprint)) ||
    typeof value.isCurrent !== 'boolean' ||
    typeof value.artifactAvailable !== 'boolean' ||
    !(value.artifactExpiresAt === null || date(value.artifactExpiresAt)) ||
    (value.artifactAvailable && (value.status !== 'succeeded' || !value.artifactExpiresAt)) ||
    !date(value.createdAt) ||
    !(value.startedAt === null || date(value.startedAt)) ||
    !(value.finishedAt === null || date(value.finishedAt)) ||
    !Array.isArray(value.diagnostics) ||
    value.diagnostics.length > 100 ||
    !value.diagnostics.every((item) => isDiagnostic(item) && item.message.length <= 2000)
  )
    invalid();
  return value as Compilation;
}

export function createCompilationApi(projectId: number, request: Request) {
  const path = `/projects/${projectId}/compilations`;
  function parseStartup(value: unknown, mode: 'latest' | 'ensure'): StartupCompilation | null {
    if (!record(value)) invalid();
    if (value.job === null && value.revisionNumber === null && mode === 'latest') return null;
    if (!record(value.job) || !validId(value.job.revisionId) || !validId(value.revisionNumber))
      invalid();
    const job = parseJob(value.job, projectId, value.job.revisionId);
    if (
      job.proposalId !== null ||
      job.candidateVersion !== null ||
      job.candidateSnapshotId !== null ||
      (mode === 'latest' && (job.status !== 'succeeded' || !job.artifactAvailable)) ||
      (mode === 'ensure' && !['queued', 'running', 'succeeded'].includes(job.status))
    )
      invalid();
    return { job, revisionNumber: value.revisionNumber };
  }
  return {
    async latestPdf(signal: AbortSignal) {
      return parseStartup(await request(`${path}/latest-pdf`, { signal }), 'latest');
    },
    async ensure(signal: AbortSignal) {
      const result = parseStartup(
        await request(`${path}/ensure`, { method: 'POST', signal }),
        'ensure',
      );
      if (!result) invalid();
      return result;
    },
    async start(revisionId: number, signal: AbortSignal) {
      if (![projectId, revisionId].every(validId)) throw new Error('Invalid revision ID');
      return parseJob(
        await request(path, { method: 'POST', body: { revisionId }, signal }),
        projectId,
        revisionId,
      );
    },
    async status(job: Compilation, signal: AbortSignal) {
      return parseJob(
        await request(`${path}/${job.id}`, { signal }),
        projectId,
        job.revisionId,
        job.id,
      );
    },
    async pdf(job: Compilation, signal: AbortSignal) {
      const pdf = await request(`${path}/${job.id}/pdf`, { responseType: 'blob', signal });
      if (
        !(pdf instanceof Blob) ||
        pdf.type !== 'application/pdf' ||
        pdf.size < 5 ||
        pdf.size > 25 * 1024 * 1024 ||
        (await pdf.slice(0, 5).text()) !== '%PDF-'
      )
        invalid();
      return pdf;
    },
  };
}

export type CompilationApi = ReturnType<typeof createCompilationApi>;
