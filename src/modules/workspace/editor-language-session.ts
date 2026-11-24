import { ApiError, type RequestOptions } from '../../shared/api/client';
import type { Position } from './compilation-diagnostics';
import { validId } from './workspace-api';

type Request = (path: string, options?: RequestOptions) => Promise<unknown>;
export type LanguageMethod = 'completion' | 'definition' | 'formatting';
export type EditorBuffers = ReadonlyMap<number, { base: string; content: string }>;
export type LanguageInput = {
  revisionId: number;
  fileId: number;
  buffers: EditorBuffers;
  method: LanguageMethod;
  position?: Position;
};
type SessionFile = { uri: string; version: number; sent: string | undefined };
type Session = { id: string; revisionId: number; files: Map<number, SessionFile> };

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const invalid = () =>
  new ApiError(200, 'INVALID_RESPONSE', 'Не вдалося прочитати відповідь редактора.', null);

export async function languageToolsAvailable(request: Request, signal: AbortSignal) {
  const result = await request('/editor/availability', { signal });
  return isRecord(result) && result.available === true;
}

export function createLanguageSession(projectId: number, request: Request) {
  let session: Session | undefined;
  let queue: Promise<unknown> = Promise.resolve();
  let idle: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  const idleMs = 45_000;

  function enqueue<T>(task: () => Promise<T>) {
    const result = queue.then(task);
    queue = result.catch(() => undefined);
    return result;
  }

  async function clear() {
    if (idle !== undefined) clearTimeout(idle);
    const previous = session;
    session = undefined;
    if (previous)
      await request(`/editor-sessions/${previous.id}`, {
        method: 'DELETE',
        signal: AbortSignal.timeout(2500),
      }).catch(() => undefined);
  }

  async function create(revisionId: number) {
    const value = await request(`/projects/${projectId}/editor-sessions`, {
      method: 'POST',
      body: { revisionId },
    });
    if (
      !isRecord(value) ||
      typeof value.id !== 'string' ||
      !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value.id)
    )
      throw invalid();

    const entry: Session = { id: value.id, revisionId, files: new Map() };
    session = entry;
    if (
      value.projectId !== projectId ||
      value.revisionId !== revisionId ||
      !Array.isArray(value.files)
    )
      throw invalid();
    for (const file of value.files) {
      if (
        !isRecord(file) ||
        !validId(file.fileId) ||
        !validId(file.documentVersion) ||
        file.uri !== `typstoria://editor/${entry.id}/files/${file.fileId}`
      )
        throw invalid();
      if (file.contentKind === 'text')
        entry.files.set(file.fileId, {
          version: file.documentVersion,
          uri: file.uri,
          sent: undefined,
        });
    }
    return entry;
  }

  async function run(input: LanguageInput, signal: AbortSignal) {
    const { buffers, revisionId, fileId, method, position } = input;
    if (
      session &&
      (session.revisionId !== revisionId ||
        [...session.files].some(([id, file]) => file.sent !== undefined && !buffers.has(id)))
    )
      await clear();
    signal.throwIfAborted();
    const entry = session ?? (await create(revisionId));
    for (const [id, buffer] of buffers) {
      signal.throwIfAborted();
      const file = entry.files.get(id);
      if (!file || buffer.content === (file.sent ?? buffer.base)) continue;
      try {
        const version = file.version + 1;
        const result = await request(`/editor-sessions/${entry.id}/files/${id}`, {
          method: 'PATCH',
          body: { expectedDocumentVersion: file.version, content: buffer.content },
        });
        if (!isRecord(result) || result.fileId !== id || result.documentVersion !== version)
          throw invalid();
        file.version = version;
        file.sent = buffer.content === buffer.base ? undefined : buffer.content;
      } catch (error) {
        // A lost response can mean the patch has already been applied.
        await clear();
        throw error;
      }
    }
    signal.throwIfAborted();
    const file = entry.files.get(fileId);
    if (!file) throw invalid();
    const value = await request(`/editor-sessions/${entry.id}/query`, {
      method: 'POST',
      body: { fileId, documentVersion: file.version, method, ...(position ? { position } : {}) },
      signal,
    });
    if (
      !isRecord(value) ||
      value.revisionId !== revisionId ||
      value.fileId !== fileId ||
      value.documentVersion !== file.version ||
      !('result' in value)
    ) {
      await clear();
      throw invalid();
    }
    return {
      result: value.result,
      files: new Map([...entry.files].map(([id, file]) => [file.uri, id])),
    };
  }

  return {
    query(input: LanguageInput, signal: AbortSignal) {
      return enqueue(async () => {
        signal.throwIfAborted();
        if (closed) throw new DOMException('Editor closed', 'AbortError');
        clearTimeout(idle);
        try {
          try {
            return await run(input, signal);
          } catch (error) {
            if (
              error instanceof ApiError &&
              (error.status === 404 || error.code === 'DOCUMENT_VERSION_CONFLICT')
            ) {
              await clear();
              return await run(input, signal);
            }
            throw error;
          }
        } catch (error) {
          if (!signal.aborted) await clear();
          throw error;
        } finally {
          if (closed) await clear();
          else if (session) idle = setTimeout(() => void enqueue(clear), idleMs);
        }
      });
    },
    dispose() {
      closed = true;
      void enqueue(clear);
    },
  };
}
