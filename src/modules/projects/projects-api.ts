import { ApiError } from '../../shared/api/client';
import type { RequestOptions } from '../../shared/api/client';
import type { components } from '../../shared/api/schema';

export type Project = components['schemas']['ProjectDto'];
export type ProjectList = components['schemas']['ProjectListDto'];
export type ProjectCreated = components['schemas']['ProjectCreatedDto'];
type Request = (path: string, options?: Omit<RequestOptions, 'accessToken'>) => Promise<unknown>;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
function id(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 2147483647;
}
function date(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}
function invalid(): never {
  throw new ApiError(200, 'INVALID_RESPONSE', 'Некоректна відповідь сервера.', null);
}

export function titleError(title: string): string {
  const trimmed = title.trim();
  if (Array.from(trimmed).length < 1 || Array.from(trimmed).length > 200)
    return 'Назва має містити від 1 до 200 символів.';
  if (/\p{Cc}/u.test(trimmed)) return 'Назва не може містити керівних символів.';
  return '';
}

export function parseProject(value: unknown): Project {
  if (
    !record(value) ||
    !id(value.id) ||
    typeof value.title !== 'string' ||
    titleError(value.title) ||
    !id(value.currentRevisionId) ||
    !date(value.createdAt) ||
    !date(value.updatedAt)
  )
    invalid();
  return {
    id: value.id,
    title: value.title,
    currentRevisionId: value.currentRevisionId,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

export function parseProjectList(value: unknown, cursor?: number): ProjectList {
  if (
    !record(value) ||
    !Array.isArray(value.items) ||
    (value.nextCursor !== null && !id(value.nextCursor))
  )
    invalid();
  const items = value.items.map(parseProject);
  if (
    items.length > 20 ||
    items.some(
      (item, index) => item.id >= (index === 0 ? (cursor ?? 2147483648) : items[index - 1]!.id),
    )
  )
    invalid();
  if (value.nextCursor !== null && value.nextCursor !== items.at(-1)?.id) invalid();
  return { items, nextCursor: value.nextCursor };
}

export function parseProjectCreated(value: unknown): ProjectCreated {
  if (
    !record(value) ||
    !id(value.projectId) ||
    !id(value.revisionId) ||
    !id(value.mainFileId) ||
    value.revisionNumber !== 1 ||
    typeof value.manifestHash !== 'string' ||
    !/^[a-f0-9]{64}$/.test(value.manifestHash) ||
    !['pending', 'ready', 'failed'].includes(String(value.historySyncStatus))
  )
    invalid();
  return {
    projectId: value.projectId,
    revisionId: value.revisionId,
    revisionNumber: 1,
    mainFileId: value.mainFileId,
    manifestHash: value.manifestHash,
    historySyncStatus: value.historySyncStatus as ProjectCreated['historySyncStatus'],
  };
}

export function createProjectsApi(request: Request) {
  return {
    async list(cursor?: number, signal?: AbortSignal) {
      return parseProjectList(
        await request('/projects', {
          query: { limit: 20, ...(cursor === undefined ? {} : { cursor }) },
          ...(signal ? { signal } : {}),
        }),
        cursor,
      );
    },
    async get(projectId: number, signal?: AbortSignal) {
      if (!id(projectId)) throw new Error('Invalid project ID');
      const project = parseProject(
        await request(`/projects/${projectId}`, signal ? { signal } : {}),
      );
      if (project.id !== projectId) invalid();
      return project;
    },
    async create(title: string, key: string, signal?: AbortSignal) {
      return parseProjectCreated(
        await request('/projects', {
          method: 'POST',
          body: { title: title.trim() },
          idempotencyKey: key,
          ...(signal ? { signal } : {}),
        }),
      );
    },
    async rename(projectId: number, title: string, signal?: AbortSignal) {
      if (!id(projectId)) throw new Error('Invalid project ID');
      const project = parseProject(
        await request(`/projects/${projectId}`, {
          method: 'PATCH',
          body: { title: title.trim() },
          ...(signal ? { signal } : {}),
        }),
      );
      if (project.id !== projectId) invalid();
      return project;
    },
    async remove(projectId: number, signal?: AbortSignal) {
      if (!id(projectId)) throw new Error('Invalid project ID');
      await request(`/projects/${projectId}`, { method: 'DELETE', ...(signal ? { signal } : {}) });
    },
  };
}
