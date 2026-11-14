import { ApiError } from '../../shared/api/client';
import type { RequestOptions } from '../../shared/api/client';
import type { components } from '../../shared/api/schema';
import { createWorkspaceApi, validId } from './workspace-api';

export type Revision = components['schemas']['RevisionDetailsDto'];
export type RevisionDiff = components['schemas']['RevisionDiffDto'];
export type RestoreInput = components['schemas']['RestoreRevisionDto'];
export type RestoredRevision = components['schemas']['RestoredRevisionDto'];
export type RevisionText = components['schemas']['ProjectTextFileDto'];
type Request = (path: string, options?: Omit<RequestOptions, 'accessToken'>) => Promise<unknown>;
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
function invalid(): never {
  throw new ApiError(200, 'INVALID_RESPONSE', 'Некоректна відповідь сервера.', null);
}

function parseRevision(value: unknown, projectId: number): Revision {
  if (
    !record(value) ||
    !validId(value.id) ||
    !validId(value.number) ||
    value.projectId !== projectId ||
    !(value.parentRevisionId === null || validId(value.parentRevisionId)) ||
    !validId(value.actorId) ||
    typeof value.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(value.createdAt)) ||
    !['pending', 'ready', 'failed'].includes(String(value.historySyncStatus)) ||
    !(value.commitSha === null || typeof value.commitSha === 'string') ||
    !(
      value.historyErrorCode === null ||
      [
        'STORAGE_UNAVAILABLE',
        'GIT_UNAVAILABLE',
        'GIT_DIVERGED',
        'WORKER_LOST',
        'MANIFEST_MISMATCH',
      ].includes(String(value.historyErrorCode))
    ) ||
    !['web', 'mcp'].includes(String(value.channel)) ||
    typeof value.operation !== 'string' ||
    typeof value.summary !== 'string' ||
    typeof value.isCurrent !== 'boolean' ||
    typeof value.manifestHash !== 'string' ||
    !/^[a-f0-9]{64}$/.test(value.manifestHash)
  )
    invalid();
  return value as Revision;
}

function parseDiff(value: unknown, fromId: number, toId: number): RevisionDiff {
  if (
    !record(value) ||
    value.fromRevisionId !== fromId ||
    value.toRevisionId !== toId ||
    !['pending', 'ready', 'failed'].includes(String(value.fromHistorySyncStatus)) ||
    !['pending', 'ready', 'failed'].includes(String(value.toHistorySyncStatus)) ||
    !Array.isArray(value.files) ||
    !record(value.context) ||
    typeof value.context.changed !== 'boolean' ||
    !(value.context.patch === null || typeof value.context.patch === 'string') ||
    !(
      value.context.patchOmittedReason === null ||
      ['BINARY', 'TEXT_TOO_LARGE', 'PATCH_LIMIT', 'COMPUTATION_LIMIT'].includes(
        String(value.context.patchOmittedReason),
      )
    ) ||
    !record(value.entrypoint) ||
    typeof value.entrypoint.changed !== 'boolean' ||
    !validId(value.entrypoint.beforeFileId) ||
    !validId(value.entrypoint.afterFileId)
  )
    invalid();
  const fileIds = new Set<number>();
  for (const file of value.files) {
    if (
      !record(file) ||
      !validId(file.fileId) ||
      fileIds.has(file.fileId) ||
      !Array.isArray(file.changes) ||
      file.changes.some(
        (change) => !['added', 'deleted', 'renamed', 'modified'].includes(String(change)),
      ) ||
      !(file.patch === null || typeof file.patch === 'string') ||
      !(
        file.patchOmittedReason === null ||
        ['BINARY', 'TEXT_TOO_LARGE', 'PATCH_LIMIT', 'COMPUTATION_LIMIT'].includes(
          String(file.patchOmittedReason),
        )
      ) ||
      ![file.before, file.after].every(
        (metadata) =>
          metadata === null ||
          (record(metadata) &&
            validId(metadata.fileId) &&
            typeof metadata.path === 'string' &&
            ['text', 'binary'].includes(String(metadata.contentKind)) &&
            Number.isSafeInteger(metadata.sizeBytes) &&
            Number(metadata.sizeBytes) >= 0 &&
            typeof metadata.mediaType === 'string' &&
            typeof metadata.sha256 === 'string' &&
            /^[a-f0-9]{64}$/.test(metadata.sha256)),
      )
    )
      invalid();
    fileIds.add(file.fileId);
  }
  return value as RevisionDiff;
}

function parseRestored(value: unknown, projectId: number, targetId: number): RestoredRevision {
  if (
    !record(value) ||
    value.projectId !== projectId ||
    !validId(value.revisionId) ||
    !validId(value.revisionNumber) ||
    !validId(value.mainFileId) ||
    value.restoredFromRevisionId !== targetId ||
    typeof value.manifestHash !== 'string' ||
    !/^[a-f0-9]{64}$/.test(value.manifestHash) ||
    !['ready', 'pending', 'failed'].includes(String(value.historySyncStatus))
  )
    invalid();
  return value as RestoredRevision;
}

export function createHistoryApi(request: Request) {
  const workspace = createWorkspaceApi(request);
  return {
    async list(projectId: number, cursor: number | undefined, signal: AbortSignal) {
      if (!validId(projectId) || (cursor !== undefined && !validId(cursor)))
        throw new Error('Invalid history cursor');
      const value = await request(`/projects/${projectId}/revisions`, {
        query: { limit: 30, ...(cursor === undefined ? {} : { cursor }) },
        signal,
      });
      if (
        !record(value) ||
        !Array.isArray(value.items) ||
        !(value.nextCursor === null || validId(value.nextCursor))
      )
        invalid();
      const items = value.items.map((item: unknown) => parseRevision(item, projectId));
      if (new Set(items.map((item) => item.id)).size !== items.length) invalid();
      return { items, nextCursor: value.nextCursor as number | null };
    },
    async diff(projectId: number, fromId: number, toId: number, signal: AbortSignal) {
      if (![projectId, fromId, toId].every(validId)) throw new Error('Invalid revision ID');
      return parseDiff(
        await request(`/projects/${projectId}/revisions/${toId}/diff`, {
          query: { against: fromId },
          signal,
        }),
        fromId,
        toId,
      );
    },
    async state(projectId: number, revisionId: number, signal: AbortSignal) {
      return workspace.state(projectId, signal, revisionId);
    },
    async text(projectId: number, fileId: number, revisionId: number, signal: AbortSignal) {
      return workspace.text(projectId, fileId, revisionId, signal);
    },
    async restore(projectId: number, body: RestoreInput, key: string, signal: AbortSignal) {
      if (
        !validId(projectId) ||
        !validId(body.targetRevisionId) ||
        !validId(body.expectedCurrentRevisionId) ||
        !/^[A-Za-z0-9._~-]{1,128}$/.test(key) ||
        (body.summary !== undefined &&
          (typeof body.summary !== 'string' ||
            body.summary.trim().length < 1 ||
            body.summary.trim().length > 500 ||
            /\p{Cc}/u.test(body.summary)))
      )
        throw new Error('Invalid restore request');
      return parseRestored(
        await request(`/projects/${projectId}/restore`, {
          method: 'POST',
          body,
          idempotencyKey: key,
          signal,
        }),
        projectId,
        body.targetRevisionId,
      );
    },
  };
}
