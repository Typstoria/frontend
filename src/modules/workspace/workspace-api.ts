import { ApiError } from '../../shared/api/client';
import type { RequestOptions } from '../../shared/api/client';
import type { components } from '../../shared/api/schema';
import { parseProject } from '../projects/projects-api';
import { matchesResourceType, maxResourceBytes } from './resource-formats';
import { filePathError } from './file-path';

export type Snapshot = Omit<components['schemas']['ProjectStateDto'], 'directories'> & {
  directories?: string[];
};
export type TextFile = components['schemas']['ProjectTextFileDto'];
export type TextChange = components['schemas']['UpdateTextDto'];
export type ContextChange = components['schemas']['UpdateContextDto'];
export type StructureChange =
  | components['schemas']['CreateTextFileDto']
  | components['schemas']['RenameFileDto']
  | components['schemas']['DeleteFileDto']
  | components['schemas']['SetEntrypointDto']
  | components['schemas']['AttachFileDto']
  | components['schemas']['ReplaceFileDto']
  | components['schemas']['CreateDirectoryDto']
  | components['schemas']['RenameDirectoryDto']
  | components['schemas']['DeleteDirectoryDto'];
export type FileChange = TextChange | ContextChange | StructureChange;
export type Changes = { baseRevisionId: number; operations: FileChange[] };
export type SaveResult = components['schemas']['ProjectChangesResultDto'];
export type ProjectUpload = components['schemas']['ProjectUploadDto'];
type Request = (path: string, options?: Omit<RequestOptions, 'accessToken'>) => Promise<unknown>;
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
export const validId = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= 2147483647;
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const syncStatus = (v: unknown) => ['pending', 'ready', 'failed'].includes(String(v));
function invalid(): never {
  throw new ApiError(200, 'INVALID_RESPONSE', 'Некоректна відповідь сервера.', null);
}
function parseFile(v: unknown): Snapshot['tree'][number] {
  if (
    !record(v) ||
    !validId(v.fileId) ||
    typeof v.path !== 'string' ||
    !v.path ||
    !['text', 'binary'].includes(String(v.contentKind)) ||
    !hash(v.sha256) ||
    !Number.isSafeInteger(v.sizeBytes) ||
    Number(v.sizeBytes) < 0 ||
    typeof v.mediaType !== 'string'
  )
    invalid();
  return {
    fileId: v.fileId,
    path: v.path,
    contentKind: v.contentKind as 'text' | 'binary',
    sha256: v.sha256,
    sizeBytes: v.sizeBytes as number,
    mediaType: v.mediaType,
  };
}
export function parseSnapshot(v: unknown, projectId: number): Snapshot {
  if (
    !record(v) ||
    !record(v.revision) ||
    !validId(v.mainFileId) ||
    typeof v.contextText !== 'string' ||
    !Array.isArray(v.tree)
  )
    invalid();
  const project = parseProject(v.project);
  const r = v.revision;
  if (
    project.id !== projectId ||
    !validId(r.id) ||
    !validId(r.number) ||
    !(r.parentRevisionId === null || validId(r.parentRevisionId)) ||
    typeof r.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(r.createdAt)) ||
    !hash(r.manifestHash) ||
    !syncStatus(r.historySyncStatus) ||
    !(r.commitSha === null || typeof r.commitSha === 'string')
  )
    invalid();
  const tree = v.tree.map(parseFile);
  const directories: unknown = v.directories ?? [];
  if (
    !Array.isArray(directories) ||
    directories.some((path) => typeof path !== 'string' || filePathError(path, [])) ||
    new Set(directories).size !== directories.length ||
    new Set(tree.map((f) => f.fileId)).size !== tree.length ||
    new Set(tree.map((f) => f.path)).size !== tree.length ||
    !tree.some((f) => f.fileId === v.mainFileId && f.contentKind === 'text')
  )
    invalid();
  return {
    project,
    mainFileId: v.mainFileId,
    contextText: v.contextText,
    directories,
    tree,
    revision: {
      id: r.id,
      number: r.number,
      parentRevisionId: r.parentRevisionId,
      createdAt: r.createdAt,
      manifestHash: r.manifestHash,
      commitSha: r.commitSha,
      historySyncStatus: r.historySyncStatus as Snapshot['revision']['historySyncStatus'],
    },
  };
}
export function parseText(v: unknown, fileId: number, revisionId: number): TextFile {
  const file = parseFile(v);
  if (
    !record(v) ||
    file.fileId !== fileId ||
    file.contentKind !== 'text' ||
    v.revisionId !== revisionId ||
    typeof v.content !== 'string'
  )
    invalid();
  return { ...file, revisionId, content: v.content };
}
export function parseSaved(
  v: unknown,
  projectId: number,
  operations?: readonly FileChange[],
): SaveResult {
  if (
    !record(v) ||
    v.projectId !== projectId ||
    !validId(v.revisionId) ||
    !validId(v.revisionNumber) ||
    !validId(v.mainFileId) ||
    !Array.isArray(v.createdFiles) ||
    !hash(v.manifestHash) ||
    !syncStatus(v.historySyncStatus)
  )
    invalid();
  const createdFiles = v.createdFiles.map((file: unknown) => {
    if (!record(file) || !validId(file.fileId) || typeof file.path !== 'string' || !file.path)
      invalid();
    return { fileId: file.fileId, path: file.path };
  });
  if (
    new Set(createdFiles.map((file) => file.fileId)).size !== createdFiles.length ||
    new Set(createdFiles.map((file) => file.path)).size !== createdFiles.length
  )
    invalid();
  if (operations) {
    const paths = operations
      .filter((op) => op.type === 'createFile' || op.type === 'attachFile')
      .map((op) => op.path.normalize('NFC'));
    if (
      paths.length !== createdFiles.length ||
      createdFiles.some((file) => !paths.includes(file.path))
    )
      invalid();
  }
  return {
    projectId,
    revisionId: v.revisionId,
    revisionNumber: v.revisionNumber,
    mainFileId: v.mainFileId,
    createdFiles,
    manifestHash: v.manifestHash,
    historySyncStatus: v.historySyncStatus as SaveResult['historySyncStatus'],
  };
}
export function createWorkspaceApi(request: Request) {
  return {
    async state(projectId: number, signal: AbortSignal, revisionId?: number) {
      if (!validId(projectId)) throw new Error('Invalid project ID');
      if (revisionId !== undefined && !validId(revisionId)) throw new Error('Invalid revision ID');
      const snapshot = parseSnapshot(
        await request(`/projects/${projectId}/state`, {
          signal,
          ...(revisionId === undefined ? {} : { query: { revisionId } }),
        }),
        projectId,
      );
      if (revisionId !== undefined && snapshot.revision.id !== revisionId) invalid();
      return snapshot;
    },
    async text(projectId: number, fileId: number, revisionId: number, signal: AbortSignal) {
      if (![projectId, fileId, revisionId].every(validId)) throw new Error('Invalid ID');
      return parseText(
        await request(`/projects/${projectId}/files/${fileId}`, { query: { revisionId }, signal }),
        fileId,
        revisionId,
      );
    },
    async save(projectId: number, body: Changes, key: string, signal: AbortSignal) {
      return parseSaved(
        await request(`/projects/${projectId}/changes`, {
          method: 'POST',
          body,
          idempotencyKey: key,
          signal,
        }),
        projectId,
        body.operations,
      );
    },
  };
}
export type WorkspaceApi = ReturnType<typeof createWorkspaceApi>;

export function createResourceApi(request: Request) {
  return {
    async upload(projectId: number, file: File, signal: AbortSignal): Promise<ProjectUpload> {
      if (!validId(projectId)) throw new Error('Invalid project ID');
      if (file.size < 1 || file.size > maxResourceBytes) throw new Error('Invalid resource size');
      const extension = file.name.split('.').at(-1)?.toLowerCase() ?? '';
      const filename = `resource.${extension}`;
      const multipart = new FormData();
      // The project path is sent in the attach operation. Keep multipart decoding
      // of the source name separate from the destination path.
      multipart.append('file', file, filename);
      const result = await request(`/projects/${projectId}/uploads`, {
        method: 'POST',
        multipart,
        signal,
      });
      if (
        !record(result) ||
        !validId(result.uploadId) ||
        result.filename !== filename ||
        typeof result.mediaType !== 'string' ||
        !matchesResourceType(result.filename, result.mediaType) ||
        !matchesResourceType(file.name, result.mediaType) ||
        result.sizeBytes !== file.size ||
        !hash(result.sha256) ||
        result.status !== 'available' ||
        typeof result.expiresAt !== 'string' ||
        !Number.isFinite(Date.parse(result.expiresAt))
      )
        invalid();
      return {
        uploadId: result.uploadId,
        filename: result.filename,
        mediaType: result.mediaType,
        sizeBytes: file.size,
        sha256: result.sha256,
        status: 'available',
        expiresAt: result.expiresAt,
      };
    },
    async download(
      projectId: number,
      file: Snapshot['tree'][number],
      revisionId: number,
      signal: AbortSignal,
    ) {
      if (![projectId, file.fileId, revisionId].every(validId)) throw new Error('Invalid ID');
      const blob = await request(`/projects/${projectId}/files/${file.fileId}/download`, {
        query: { revisionId },
        responseType: 'blob',
        signal,
      });
      if (!(blob instanceof Blob) || blob.size !== file.sizeBytes || blob.type !== file.mediaType)
        invalid();
      return blob;
    },
  };
}
