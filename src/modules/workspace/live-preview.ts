import { shallowRef } from 'vue';
import type { Snapshot, WorkspaceApi } from './workspace-api';
import type { createResourceApi } from './workspace-api';
import type {
  LivePreviewCompileRequest,
  LivePreviewDiagnostic,
  LivePreviewResponse,
} from './live-preview-protocol';

type Content = string | Uint8Array;
export type PreviewInput = {
  revisionId: number;
  mainFileId: number;
  tree: Snapshot['tree'];
  texts: ReadonlyMap<number, string>;
};
type Request = { generation: number; input: PreviewInput; due: number };
type File = Snapshot['tree'][number];
type CachedFile = { hash: string; content: Content };
const maxInputBytes = 20 * 1024 * 1024;
const maxOutputBytes = 32 * 1024 * 1024;
const editDelay = 60;

export function createLivePreview(
  projectId: number,
  source: Pick<WorkspaceApi, 'text'>,
  resource: Pick<ReturnType<typeof createResourceApi>, 'download'>,
  makeWorker = () =>
    new Worker(new URL('./live-preview.worker.ts', import.meta.url), { type: 'module' }),
) {
  const document = shallowRef<Uint8Array>();
  const diagnostics = shallowRef<LivePreviewDiagnostic[]>([]);
  let worker: Worker | undefined;
  let generation = 0;
  let wanted: Request | undefined;
  let active: Request | undefined;
  let fetchAbort: AbortController | undefined;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
  let hasCompiled = false;
  let hasCurrentOutput = false;
  let retryAfter = 0;
  const cache = new Map<number, CachedFile>();
  let sent = new Map<string, Content>();
  let sentEntrypoint: string | undefined;

  function clearWorker() {
    worker?.terminate();
    worker = undefined;
    hasCompiled = false;
    hasCurrentOutput = false;
    sent.clear();
    sentEntrypoint = undefined;
  }

  function complete(request: Request) {
    if (active !== request) return;
    clearTimeout(deadlineTimer);
    fetchAbort?.abort();
    fetchAbort = undefined;
    active = undefined;
    drain();
  }

  function unavailable(request: Request) {
    if (active !== request) return;
    clearWorker();
    retryAfter = performance.now() + 2_000;
    document.value = undefined;
    diagnostics.value = [];
    complete(request);
  }

  function accept(onWorker: Worker, message: LivePreviewResponse) {
    const request = active;
    if (onWorker !== worker || !request || message.generation !== request.generation) return;
    if (message.type === 'failed' && message.reason === 'unavailable') return unavailable(request);
    hasCompiled = true;
    hasCurrentOutput = request.generation === generation;
    if (request.generation === generation) {
      if (message.type === 'compiled' && message.document instanceof Uint8Array) {
        if (!message.document.byteLength || message.document.byteLength > maxOutputBytes)
          return unavailable(request);
        document.value = message.document;
        diagnostics.value = message.diagnostics ?? [];
      } else if (message.type === 'failed') diagnostics.value = message.diagnostics ?? [];
    }
    complete(request);
  }

  function ensureWorker() {
    if (worker) return worker;
    const created = makeWorker();
    worker = created;
    created.onmessage = ({ data }: MessageEvent<LivePreviewResponse>) => accept(created, data);
    const fail = () => {
      if (created !== worker) return;
      if (active) unavailable(active);
      else clearWorker();
    };
    created.onerror = fail;
    created.onmessageerror = fail;
    return created;
  }

  function warm() {
    if (performance.now() < retryAfter) return;
    try {
      ensureWorker();
    } catch {
      // The editor keeps using its server PDF when workers are unavailable.
    }
  }

  async function read(file: File, revisionId: number, signal: AbortSignal): Promise<Content> {
    const existing = cache.get(file.fileId);
    if (existing?.hash === file.sha256) return existing.content;
    if (file.contentKind === 'binary') {
      const blob = await resource.download(projectId, file, revisionId, signal);
      return new Uint8Array(await blob.arrayBuffer());
    }
    const text = await source.text(projectId, file.fileId, revisionId, signal);
    if (text.sha256 !== file.sha256 || text.path !== file.path)
      throw new Error('Preview snapshot changed');
    return text.content;
  }

  async function prepare(request: Request, signal: AbortSignal) {
    const { tree, revisionId, mainFileId, texts } = request.input;
    const entrypoint = tree.find((file) => file.fileId === mainFileId)?.path;
    if (!entrypoint || tree.length > 500) throw new Error('Invalid preview snapshot');
    const encoder = new TextEncoder();
    const bytes = tree.reduce((sum, file) => {
      const text = texts.get(file.fileId);
      return sum + (text === undefined ? file.sizeBytes : encoder.encode(text).byteLength);
    }, 0);
    if (bytes > maxInputBytes) throw new Error('Preview snapshot too large');
    const project = new Map<string, Content>();
    const nextCache = new Map<number, CachedFile>();
    for (let i = 0; i < tree.length; i += 6) {
      signal.throwIfAborted();
      await Promise.all(
        tree.slice(i, i + 6).map(async (file) => {
          const edited = file.contentKind === 'text' ? texts.get(file.fileId) : undefined;
          const content = edited ?? (await read(file, revisionId, signal));
          project.set(file.path, content);
          if (edited === undefined) nextCache.set(file.fileId, { hash: file.sha256, content });
        }),
      );
    }
    signal.throwIfAborted();
    cache.clear();
    for (const [key, value] of nextCache) cache.set(key, value);
    const changes: { path: string; content: Content | null }[] = [];
    for (const path of sent.keys()) if (!project.has(path)) changes.push({ path, content: null });
    for (const [path, content] of project) {
      if (sent.get(path) !== content) changes.push({ path, content });
    }
    return { entrypoint, project, changes };
  }

  function drain() {
    clearTimeout(debounceTimer);
    if (active || !wanted) return;
    const wait = Math.max(wanted.due, retryAfter) - performance.now();
    if (wait > 0) {
      debounceTimer = setTimeout(drain, wait);
      return;
    }
    const request = wanted;
    wanted = undefined;
    active = request;
    const controller = new AbortController();
    fetchAbort = controller;
    deadlineTimer = setTimeout(() => unavailable(request), hasCompiled ? 12_000 : 40_000);
    void (async () => {
      try {
        const target = ensureWorker();
        const { entrypoint, project, changes } = await prepare(request, controller.signal);
        if (request.generation !== generation) return complete(request);
        if (!changes.length && entrypoint === sentEntrypoint && hasCurrentOutput)
          return complete(request);
        fetchAbort = undefined;
        const message: LivePreviewCompileRequest = {
          type: 'compile',
          generation: request.generation,
          entrypoint,
          changes,
        };
        target.postMessage(message);
        sent = project;
        sentEntrypoint = entrypoint;
      } catch {
        if (controller.signal.aborted) return;
        unavailable(request);
      }
    })();
  }

  return {
    document,
    diagnostics,
    warm,
    request(input: PreviewInput) {
      wanted = { generation: ++generation, input, due: performance.now() + editDelay };
      if (active && active.input.revisionId !== input.revisionId && fetchAbort) {
        // A newer revision may remove or replace dependencies in flight.
        // Leave a submitted job to finish and discard its stale output.
        complete(active);
      }
      drain();
    },
    discard(result: Uint8Array) {
      if (document.value === result) {
        document.value = undefined;
        hasCurrentOutput = false;
      }
    },
    reset() {
      generation++;
      wanted = undefined;
      active = undefined;
      clearTimeout(debounceTimer);
      clearTimeout(deadlineTimer);
      fetchAbort?.abort();
      fetchAbort = undefined;
      cache.clear();
      clearWorker();
      retryAfter = 0;
      document.value = undefined;
      diagnostics.value = [];
    },
  };
}
