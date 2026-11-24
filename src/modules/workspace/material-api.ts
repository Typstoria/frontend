import { ApiError, type RequestOptions } from '../../shared/api/client';
import type { components } from '../../shared/api/schema';
import type { Material } from './material-metadata';
import { validId } from './workspace-api';

export const materialAccept = '.txt,.md,.csv,.pdf,.xlsx';
export const materialByteLimit = 10 * 1024 * 1024;
type Schemas = components['schemas'];
type MaterialVersion = Schemas['MaterialVersionDto'];
export type MaterialChunk = Schemas['MaterialChunkDto'];
export type MaterialRead = Schemas['MaterialReadDto'];
export type MaterialSearch = Schemas['MaterialSearchDto'];
type Cursor = NonNullable<MaterialSearch['nextCursor']>;
type Request = (path: string, options?: Omit<RequestOptions, 'accessToken'>) => Promise<unknown>;

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const offset = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 2000;

function invalid(): never {
  throw new ApiError(200, 'INVALID_RESPONSE', 'Некоректна відповідь сервера.', null);
}

export function materialFileError(file: File): string {
  if (!file.size) return 'Виберіть непорожній файл.';
  if (file.size > materialByteLimit) return 'Файл має бути не більшим за 10 МіБ.';
  if (!/\.(txt|md|csv|pdf|xlsx)$/iu.test(file.name)) return 'Виберіть TXT, MD, CSV, PDF або XLSX.';
  if (file.name.normalize('NFC').length > 255 || /[\\/\p{Cc}]/u.test(file.name))
    return 'Назва файла має містити до 255 символів без керівних символів та розділювачів шляху.';
  return '';
}

function isChunk(value: unknown): value is MaterialChunk {
  return (
    record(value) &&
    offset(value.index) &&
    typeof value.text === 'string' &&
    (value.page === undefined || validId(value.page)) &&
    (value.sheet === undefined || typeof value.sheet === 'string') &&
    (value.row === undefined || validId(value.row)) &&
    (value.line === undefined || validId(value.line))
  );
}

function parseVersion(value: unknown): MaterialVersion {
  if (
    !record(value) ||
    !validId(value.versionId) ||
    typeof value.filename !== 'string' ||
    typeof value.sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(value.sha256) ||
    !validId(value.sizeBytes) ||
    value.sizeBytes > materialByteLimit ||
    typeof value.mediaType !== 'string' ||
    typeof value.status !== 'string' ||
    !['pending', 'running', 'ready', 'failed'].includes(value.status) ||
    !(value.errorCode === null || typeof value.errorCode === 'string') ||
    !(value.parserFingerprint === null || typeof value.parserFingerprint === 'string') ||
    typeof value.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(value.createdAt))
  )
    invalid();
  return value as MaterialVersion;
}

export function chunkLocation(chunk: MaterialChunk): string {
  return [
    chunk.page ? `Сторінка ${chunk.page}` : '',
    chunk.sheet ?? '',
    chunk.row ? `Рядок ${chunk.row}` : '',
    chunk.line ? `Рядок ${chunk.line}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

export function createMaterialApi(projectId: number, request: Request) {
  const path = `/projects/${projectId}`;
  return {
    async upload(file: File, signal: AbortSignal) {
      if (materialFileError(file)) throw new Error('Invalid material file');
      const multipart = new FormData();
      // The display name is set explicitly in the revision change, separately from multipart encoding.
      const filename = `material.${file.name.split('.').at(-1)!.toLowerCase()}`;
      multipart.append('file', file, filename);
      const version = parseVersion(
        await request(`${path}/material-versions`, {
          method: 'POST',
          multipart,
          signal,
        }),
      );
      if (version.filename !== filename || version.sizeBytes !== file.size) invalid();
      return version;
    },
    async read(material: Material, revisionId: number, start: number, signal: AbortSignal) {
      const value = await request(`${path}/materials/${material.materialId}`, {
        query: { revisionId, offset: start },
        signal,
      });
      const version = parseVersion(value);
      if (
        !record(value) ||
        value.revisionId !== revisionId ||
        value.materialId !== material.materialId ||
        value.name !== material.name ||
        version.versionId !== material.versionId ||
        version.sha256 !== material.sha256 ||
        version.sizeBytes !== material.sizeBytes ||
        !Array.isArray(value.chunks) ||
        !value.chunks.every(isChunk) ||
        !(value.nextOffset === null || (offset(value.nextOffset) && value.nextOffset > start))
      )
        invalid();
      return value as MaterialRead;
    },
    async search(query: string, revisionId: number, cursor: Cursor | null, signal: AbortSignal) {
      const value = await request(`${path}/materials/search`, {
        method: 'POST',
        body: { revisionId, query, ...(cursor ?? {}) },
        signal,
      });
      if (
        !record(value) ||
        value.revisionId !== revisionId ||
        !Array.isArray(value.matches) ||
        !value.matches.every(
          (item) =>
            record(item) &&
            validId(item.materialId) &&
            validId(item.versionId) &&
            typeof item.name === 'string' &&
            typeof item.sha256 === 'string' &&
            /^[a-f0-9]{64}$/.test(item.sha256) &&
            isChunk(item),
        ) ||
        !(
          value.nextCursor === null ||
          (record(value.nextCursor) &&
            validId(value.nextCursor.materialId) &&
            offset(value.nextCursor.offset) &&
            (!cursor ||
              value.nextCursor.materialId > cursor.materialId ||
              (value.nextCursor.materialId === cursor.materialId &&
                value.nextCursor.offset > cursor.offset)))
        )
      )
        invalid();
      return value as MaterialSearch;
    },
    async download(material: Material, revisionId: number, signal: AbortSignal) {
      const value = await request(`${path}/materials/${material.materialId}/download`, {
        query: { revisionId },
        responseType: 'blob',
        signal,
      });
      if (!(value instanceof Blob) || value.size !== material.sizeBytes) invalid();
      return value;
    },
  };
}
