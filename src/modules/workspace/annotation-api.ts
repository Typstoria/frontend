import { ApiError, type RequestOptions } from '../../shared/api/client';
import type { components } from '../../shared/api/schema';
import { validId } from './workspace-api';

type Schemas = components['schemas'];
export type Annotation = Schemas['AnnotationDto'];
export type TextAnchor = Schemas['TextAnchorDto'];
export type AnnotationUpdate = Schemas['UpdateAnnotationDto'];
type Request = (path: string, options?: Omit<RequestOptions, 'accessToken'>) => Promise<unknown>;

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const offset = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 1048576;

function invalid(): never {
  throw new ApiError(200, 'INVALID_RESPONSE', 'Некоректна відповідь сервера.', null);
}

export function isTextAnchor(value: unknown): value is TextAnchor {
  return (
    record(value) &&
    validId(value.fileId) &&
    offset(value.start) &&
    offset(value.end) &&
    typeof value.quote === 'string' &&
    value.quote.length > 0 &&
    value.end - value.start === value.quote.length &&
    typeof value.prefix === 'string' &&
    typeof value.suffix === 'string'
  );
}

function isAnnotation(value: unknown, projectId: number, revisionId: number): value is Annotation {
  if (
    !record(value) ||
    !validId(value.id) ||
    !validId(value.version) ||
    value.projectId !== projectId ||
    value.viewedRevisionId !== revisionId ||
    !validId(value.revisionId) ||
    !validId(value.creatorId) ||
    !isTextAnchor(value.anchor) ||
    value.anchor.fileId !== value.fileId ||
    typeof value.body !== 'string' ||
    (value.status !== 'active' && value.status !== 'resolved') ||
    (value.channel !== 'web' && value.channel !== 'mcp') ||
    typeof value.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(value.createdAt)) ||
    !record(value.position)
  )
    return false;
  const { state, start, end } = value.position;
  if (state === 'attached')
    return offset(start) && offset(end) && end - start === value.anchor.quote.length;
  return (state === 'outdated' || state === 'orphaned') && start === null && end === null;
}

export function createAnnotationsApi(projectId: number, request: Request) {
  const path = `/projects/${projectId}/annotations`;
  return {
    async list(revisionId: number, cursor: number | null, signal: AbortSignal) {
      const value = await request(path, {
        query: { revisionId, limit: 100, ...(cursor === null ? {} : { cursor }) },
        signal,
      });
      if (
        !record(value) ||
        !Array.isArray(value.items) ||
        !value.items.every((item) => isAnnotation(item, projectId, revisionId)) ||
        !(
          value.nextCursor === null ||
          (validId(value.nextCursor) && (cursor === null || value.nextCursor < cursor))
        )
      )
        invalid();
      return value as Schemas['AnnotationListDto'];
    },
    async update(
      item: Annotation,
      change: Omit<AnnotationUpdate, 'expectedAnnotationVersion'>,
      signal: AbortSignal,
    ) {
      const result = await request(`${path}/${item.id}`, {
        method: 'PATCH',
        body: { ...change, expectedAnnotationVersion: item.version },
        signal,
      });
      if (!record(result) || result.id !== item.id || result.version !== item.version + 1)
        invalid();
    },
    async remove(item: Annotation, signal: AbortSignal) {
      await request(`${path}/${item.id}`, {
        method: 'DELETE',
        body: { expectedAnnotationVersion: item.version },
        signal,
      });
    },
  };
}
