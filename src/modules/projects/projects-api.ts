import { ApiError } from '../../shared/api/client';
import type { RequestOptions } from '../../shared/api/client';
import type { components } from '../../shared/api/schema';

type ApiProject = components['schemas']['ProjectDto'];
export type Project = Omit<ApiProject, 'preview'> & {
  preview: { revisionId: number; version: string } | null;
};
type ApiProjectList = components['schemas']['ProjectListDto'];
export type ProjectList = Omit<ApiProjectList, 'items'> & { items: Project[] };
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
function parsePreview(value: unknown): Project['preview'] {
  // Older API instances may omit preview while a rolling deployment is in progress.
  if (value === undefined || value === null) return null;
  if (
    !record(value) ||
    !id(value.revisionId) ||
    typeof value.version !== 'string' ||
    !/^[a-f0-9]{64}$/.test(value.version)
  )
    invalid();
  return { revisionId: value.revisionId, version: value.version };
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
    preview: parsePreview(value.preview),
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
  let activePreviewRequests = 0;
  const previewWaiters: Array<{
    signal: AbortSignal;
    resolve: (release: () => void) => void;
    reject: (error: unknown) => void;
    abort: () => void;
  }> = [];
  function releasePreviewSlot() {
    activePreviewRequests--;
    while (previewWaiters.length) {
      const next = previewWaiters.shift()!;
      if (next.signal.aborted) continue;
      next.signal.removeEventListener('abort', next.abort);
      activePreviewRequests++;
      next.resolve(releasePreviewSlot);
      break;
    }
  }
  async function acquirePreviewSlot(signal: AbortSignal): Promise<() => void> {
    signal.throwIfAborted();
    if (activePreviewRequests < 4) {
      activePreviewRequests++;
      return releasePreviewSlot;
    }
    return new Promise((resolve, reject) => {
      const waiter = {
        signal,
        resolve,
        reject,
        abort: () => {
          const index = previewWaiters.indexOf(waiter);
          if (index >= 0) previewWaiters.splice(index, 1);
          reject(signal.reason);
        },
      };
      previewWaiters.push(waiter);
      signal.addEventListener('abort', waiter.abort, { once: true });
    });
  }
  return {
    async list(cursor?: number, signal?: AbortSignal, search?: string) {
      const normalizedSearch = search?.trim();
      return parseProjectList(
        await request('/projects', {
          query: {
            limit: 20,
            ...(cursor === undefined ? {} : { cursor }),
            ...(normalizedSearch ? { search: normalizedSearch } : {}),
          },
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
    async preview(projectId: number, version: string, signal: AbortSignal) {
      if (!id(projectId) || !/^[a-f0-9]{64}$/.test(version))
        throw new Error('Invalid project preview request');
      const release = await acquirePreviewSlot(signal);
      try {
        const value = await request(`/projects/${projectId}/preview`, {
          query: { version },
          responseType: 'blob',
          signal,
        });
        if (
          !(value instanceof Blob) ||
          value.type !== 'image/png' ||
          value.size === 0 ||
          value.size > 2 * 1024 * 1024
        )
          invalid();
        const signature = new Uint8Array(await value.slice(0, 8).arrayBuffer());
        if (
          signature.length !== 8 ||
          ![137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => signature[index] === byte)
        )
          invalid();
        return value;
      } finally {
        release();
      }
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
