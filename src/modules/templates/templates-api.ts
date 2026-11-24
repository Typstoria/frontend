import { ApiError, createApiClient, type RequestOptions } from '../../shared/api/client';
import type { components } from '../../shared/api/schema';
import { identitySession } from '../identity/identity-session';
import { SHARED_TEMPLATE_PATH, shareToken } from './share-navigation';
import { parseProjectCreated } from '../projects/projects-api';

type Schema = components['schemas'];
export type SystemTemplate = Schema['SystemTemplateDto'];
export type OwnedTemplate = Schema['TemplateDto'];
export type Preview = Schema['TemplatePreviewDto'];
export type Share = Schema['TemplateShareDto'];
export type TemplateSource = { kind: 'system'; key: string } | { kind: 'owned'; id: number };
export type Source = TemplateSource | { kind: 'shared'; token: string };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
function id(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 2147483647;
}
function size(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
function date(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}
function invalid(): never {
  throw new ApiError(200, 'INVALID_RESPONSE', 'Некоректна відповідь сервера.', null);
}
function list<T>(value: unknown, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) invalid();
  return value.map(parse);
}
function string(value: unknown): string {
  if (typeof value !== 'string') invalid();
  return value;
}
function system(value: unknown): SystemTemplate {
  if (!record(value) || typeof value.key !== 'string' || !/^[a-z0-9-]+$/.test(value.key)) invalid();
  return { key: value.key, title: string(value.title), description: string(value.description) };
}
function owned(value: unknown): OwnedTemplate {
  if (
    !record(value) ||
    !id(value.id) ||
    !date(value.createdAt) ||
    !size(value.sizeBytes) ||
    typeof value.includeContext !== 'boolean'
  )
    invalid();
  return {
    id: value.id,
    title: string(value.title),
    description: string(value.description),
    createdAt: value.createdAt,
    sizeBytes: value.sizeBytes,
    includeContext: value.includeContext,
  };
}
function share(value: unknown): Share {
  if (
    !record(value) ||
    !id(value.id) ||
    !date(value.createdAt) ||
    !date(value.expiresAt) ||
    (value.revokedAt !== null && !date(value.revokedAt))
  )
    invalid();
  return {
    id: value.id,
    createdAt: value.createdAt,
    expiresAt: value.expiresAt,
    revokedAt: value.revokedAt,
  };
}
function preview(value: unknown): Preview {
  if (!record(value) || typeof value.includeContext !== 'boolean') invalid();
  const annotationCount = value.annotationCount ?? 0;
  if (!size(annotationCount)) invalid();
  const entrypoint = string(value.entrypoint);
  const files = list(value.files, (file) => {
    if (
      !record(file) ||
      !size(file.sizeBytes) ||
      (file.contentKind !== 'text' && file.contentKind !== 'binary')
    )
      invalid();
    return {
      path: string(file.path),
      contentKind: file.contentKind,
      mediaType: string(file.mediaType),
      sizeBytes: file.sizeBytes,
      sha256: string(file.sha256),
    } as Schema['TemplateFileDto'];
  });
  if (!files.some((file) => file.path === entrypoint && file.contentKind === 'text')) invalid();
  return {
    title: string(value.title),
    description: string(value.description),
    entrypoint,
    files,
    includeContext: value.includeContext,
    contextText: string(value.contextText),
    annotationCount,
    directories: list(value.directories ?? [], string),
    materials: list(value.materials, (material) => {
      if (!record(material) || !size(material.index) || !size(material.sizeBytes)) invalid();
      return {
        index: material.index,
        name: string(material.name),
        filename: string(material.filename),
        mediaType: string(material.mediaType),
        sizeBytes: material.sizeBytes,
        sha256: string(material.sha256),
      };
    }),
  };
}
function page<T extends { id: number }>(
  value: unknown,
  parse: (item: unknown) => T,
  cursor?: number,
) {
  if (!record(value) || (value.nextCursor !== null && !id(value.nextCursor))) invalid();
  const items = list(value.items, parse);
  if (
    items.length > 20 ||
    items.some(
      (item, index) => item.id >= (index ? items[index - 1]!.id : (cursor ?? 2147483648)),
    ) ||
    (value.nextCursor !== null && value.nextCursor !== items.at(-1)?.id)
  )
    invalid();
  return { items, nextCursor: value.nextCursor };
}
function blob(value: unknown): Blob {
  if (!(value instanceof Blob)) invalid();
  return value;
}
function archive(value: unknown): Blob {
  const data = blob(value);
  if (data.type !== 'application/zip' || data.size === 0 || data.size > MAX_ZIP_BYTES) invalid();
  return data;
}
function path(source: Source) {
  if (source.kind === 'system') return `/templates/system/${source.key}`;
  return source.kind === 'owned' ? `/templates/${source.id}` : '/template-shares';
}
function options(source: Source, signal: AbortSignal): RequestOptions {
  return { signal, ...(source.kind === 'shared' ? { templateShareToken: source.token } : {}) };
}
function query(cursor?: number) {
  return { limit: 20, ...(cursor === undefined ? {} : { cursor }) };
}
export const MAX_ZIP_BYTES = 32 * 1024 * 1024;
export function createTemplatesApi(
  privateRequest = identitySession.request,
  publicRequest = createApiClient('/api'),
) {
  const read = (source: Source) => (source.kind === 'owned' ? privateRequest : publicRequest);
  return {
    async coverSource(source: Source, signal: AbortSignal) {
      return archive(
        await read(source)(path(source) + '/cover-source', {
          ...options(source, signal),
          responseType: 'blob',
        }),
      );
    },
    async systems(signal: AbortSignal) {
      return list(await publicRequest('/templates/system', { signal }), system);
    },
    async owned(signal: AbortSignal, cursor?: number) {
      return page(
        await privateRequest('/templates', { signal, query: query(cursor) }),
        owned,
        cursor,
      );
    },
    async preview(source: Source, signal: AbortSignal) {
      const endpoint = source.kind === 'shared' ? '/preview' : '';
      return preview(await read(source)(path(source) + endpoint, options(source, signal)));
    },
    async file(
      source: Exclude<Source, { kind: 'system' }>,
      file: Schema['TemplateFileDto'],
      signal: AbortSignal,
    ) {
      const data = blob(
        await read(source)(path(source) + '/file', {
          ...options(source, signal),
          query: { path: file.path },
          responseType: 'blob',
        }),
      );
      if (data.size !== file.sizeBytes) invalid();
      return data;
    },
    async copy(source: Source, title: string, key: string, signal: AbortSignal) {
      return parseProjectCreated(
        await privateRequest(path(source) + '/copy', {
          ...options(source, signal),
          method: 'POST',
          body: { title },
          idempotencyKey: key,
        }),
      );
    },
    async create(
      projectId: number,
      body: {
        title: string;
        description: string;
        revisionId: number;
        includeContext: boolean;
        includeAnnotations?: boolean;
      },
      signal: AbortSignal,
    ) {
      return owned(
        await privateRequest(`/projects/${projectId}/template-versions`, {
          method: 'POST',
          body,
          signal,
        }),
      );
    },
    async remove(templateId: number, signal: AbortSignal) {
      await privateRequest(`/templates/${templateId}`, { method: 'DELETE', signal });
    },
    async download(source: Exclude<Source, { kind: 'system' }>, signal: AbortSignal) {
      return archive(
        await read(source)(path(source) + '/download', {
          ...options(source, signal),
          responseType: 'blob',
        }),
      );
    },
    async shares(templateId: number, signal: AbortSignal, cursor?: number) {
      return page(
        await privateRequest(`/templates/${templateId}/shares`, { signal, query: query(cursor) }),
        share,
        cursor,
      );
    },
    async createShare(templateId: number, expiresInDays: number, signal: AbortSignal) {
      const value = await privateRequest(`/templates/${templateId}/shares`, {
        method: 'POST',
        body: { expiresInDays },
        signal,
      });
      if (!record(value) || typeof value.shareUrl !== 'string' || typeof value.token !== 'string')
        invalid();
      const url = new URL(value.shareUrl);
      if (
        !['https:', 'http:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.pathname !== SHARED_TEMPLATE_PATH ||
        url.search ||
        shareToken(url.hash) !== value.token
      )
        invalid();
      return { ...share(value), shareUrl: url.href };
    },
    async revoke(templateId: number, shareId: number, signal: AbortSignal) {
      await privateRequest(`/templates/${templateId}/shares/${shareId}`, {
        method: 'DELETE',
        signal,
      });
    },
    async importZip(
      file: File,
      title: string,
      entrypoint: string,
      key: string,
      signal: AbortSignal,
    ) {
      const multipart = new FormData();
      multipart.set('file', file);
      multipart.set('title', title);
      if (entrypoint) multipart.set('entrypoint', entrypoint);
      return parseProjectCreated(
        await privateRequest('/projects/import', {
          method: 'POST',
          multipart,
          idempotencyKey: key,
          signal,
        }),
      );
    },
    async exportZip(
      projectId: number,
      revisionId: number,
      profile: 'document' | 'project',
      signal: AbortSignal,
    ) {
      return archive(
        await privateRequest(`/projects/${projectId}/export`, {
          signal,
          query: {
            revisionId,
            profile,
            ...(profile === 'project' ? { includeAnnotations: 'true' } : {}),
          },
          responseType: 'blob',
        }),
      );
    },
  };
}

export function transferError(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  if (error.code === 'TEMPLATE_QUOTA_EXCEEDED')
    return 'Досягнуто ліміту для шаблонів. Видаліть непотрібний шаблон і повторіть спробу.';
  if (error.code === 'SHARE_QUOTA_EXCEEDED')
    return 'Досягнуто ліміту активних посилань. Відкличте непотрібне посилання.';
  if (error.code === 'ARCHIVE_BUSY' || error.status === 429)
    return 'Зараз забагато запитів. Зачекайте трохи й повторіть спробу.';
  if (error.code === 'ARCHIVE_LIMIT' || error.status === 413)
    return 'Архів перевищує допустимий розмір або містить забагато файлів.';
  if (error.status === 404) return 'Цей вміст більше недоступний.';
  return fallback;
}
