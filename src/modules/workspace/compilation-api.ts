import { ApiError, type RequestOptions } from '../../shared/api/client';
import type { components } from '../../shared/api/schema';
import { validId } from './workspace-api';

// This workspace compiles accepted revisions; proposal previews use a separate flow.
export type Compilation = components['schemas']['CompilationDto'] & { revisionId: number };
export type Diagnostic = components['schemas']['CompileDiagnosticDto'];
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
    value.diagnostics.length > 100
  )
    invalid();
  for (const diagnostic of value.diagnostics) {
    if (
      !record(diagnostic) ||
      !(diagnostic.fileId === null || validId(diagnostic.fileId)) ||
      !(diagnostic.path === null || typeof diagnostic.path === 'string') ||
      !['error', 'warning'].includes(String(diagnostic.severity)) ||
      typeof diagnostic.message !== 'string' ||
      diagnostic.message.length > 2000 ||
      diagnostic.range !== null
    )
      invalid();
  }
  return value as Compilation;
}

export function createCompilationApi(projectId: number, request: Request) {
  const path = `/projects/${projectId}/compilations`;
  return {
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
