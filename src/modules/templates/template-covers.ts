import { createTypstRenderer, type TypstRenderer } from '@myriaddreamin/typst.ts';
import rendererWasm from '@myriaddreamin/typst-ts-renderer/wasm?url';
import { unzipSync } from 'fflate';
import type {
  LivePreviewChange,
  LivePreviewCompileRequest,
  LivePreviewResponse,
} from '../workspace/live-preview-protocol';
import { createTemplatesApi, type Source } from './templates-api';

const manifestPath = '.typstoria/transfer.json';
const maxSourceBytes = 20 * 1024 * 1024;

function documentFiles(archive: ArrayBuffer) {
  let size = 0;
  let count = 0;
  const files = unzipSync(new Uint8Array(archive), {
    filter(file) {
      if (file.name.endsWith('/')) return false;
      if (file.compression !== 0 || ++count > 501 || (size += file.originalSize) > maxSourceBytes)
        throw new Error('Template cover source exceeds browser limits');
      return true;
    },
  });
  const manifest = files[manifestPath];
  if (!manifest) throw new Error('Template cover manifest is missing');
  const data: { entrypoint?: unknown } = JSON.parse(new TextDecoder().decode(manifest));
  delete files[manifestPath];
  if (typeof data.entrypoint !== 'string' || !Object.hasOwn(files, data.entrypoint))
    throw new Error('Template cover entrypoint is missing');
  return { entrypoint: data.entrypoint, files };
}

function sourceKey(source: Source) {
  if (source.kind === 'system') return `system:${source.key}`;
  return source.kind === 'owned' ? `owned:${source.id}` : `shared:${source.token}`;
}

async function firstPage(renderer: TypstRenderer, bytes: Uint8Array) {
  return renderer.runWithSession({ format: 'vector', artifactContent: bytes }, async (session) => {
    const page = session.retrievePagesInfo()[0];
    if (
      !page ||
      ![page.width, page.height].every((dimension) => Number.isFinite(dimension) && dimension > 0)
    )
      throw new Error('Template has no renderable first page');
    const scale = Math.min(720 / page.width, 960 / page.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(page.width * scale));
    canvas.height = Math.max(1, Math.ceil(page.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Template preview canvas is unavailable');
    try {
      await renderer.renderCanvas({
        renderSession: session,
        canvas: context,
        pageOffset: 0,
        pixelPerPt: scale,
        backgroundColor: '#ffffff',
        dataSelection: { body: true },
      });
      return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((image) =>
          image ? resolve(image) : reject(new Error('Template image is unavailable')),
        );
      });
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  });
}

export function createTemplateCovers() {
  const api = createTemplatesApi();
  const lifecycle = new AbortController();
  const cache = new Map<string, Blob>();
  let renderer: Promise<TypstRenderer> | undefined;
  let worker: Worker | undefined;
  let previousPaths: string[] = [];
  let generation = 0;
  let pending = Promise.resolve();

  function stopWorker() {
    worker?.terminate();
    worker = undefined;
    previousPaths = [];
  }

  function compile(entrypoint: string, files: Record<string, Uint8Array>, signal: AbortSignal) {
    signal.throwIfAborted();
    const target = (worker ??= new Worker(
      new URL('../workspace/live-preview.worker.ts', import.meta.url),
      { type: 'module' },
    ));
    const changes: LivePreviewChange[] = previousPaths
      .filter((path) => !Object.hasOwn(files, path))
      .map((path) => ({ path, content: null }));
    for (const [path, content] of Object.entries(files)) changes.push({ path, content });
    previousPaths = Object.keys(files);
    const message: LivePreviewCompileRequest = {
      type: 'compile',
      generation: ++generation,
      entrypoint,
      changes,
    };

    return new Promise<Uint8Array>((resolve, reject) => {
      const timeout = setTimeout(fail, 40_000);
      function cleanup() {
        clearTimeout(timeout);
        signal.removeEventListener('abort', fail);
        target.onmessage = null;
        target.onerror = null;
        target.onmessageerror = null;
      }
      function fail() {
        cleanup();
        stopWorker();
        reject(signal.reason ?? new Error('Template compiler unavailable'));
      }
      signal.addEventListener('abort', fail, { once: true });
      target.onerror = fail;
      target.onmessageerror = fail;
      target.onmessage = ({ data }: MessageEvent<LivePreviewResponse>) => {
        if (data.generation !== message.generation) return;
        if (data.type === 'failed' && data.reason === 'unavailable') return fail();
        cleanup();
        if (
          data.type === 'compiled' &&
          data.document.length &&
          data.document.length <= 32 * 1024 * 1024
        )
          resolve(data.document);
        else reject(new Error('Template document could not be compiled'));
      };
      try {
        target.postMessage(message);
      } catch {
        fail();
      }
    });
  }

  async function render(source: Source, signal: AbortSignal) {
    const key = sourceKey(source);
    signal.throwIfAborted();
    const cached = cache.get(key);
    if (cached) return cached;
    const zip = await api.coverSource(
      source,
      AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
    );
    const { files, entrypoint } = documentFiles(await zip.arrayBuffer());
    const bytes = await compile(entrypoint, files, signal);
    signal.throwIfAborted();
    if (!renderer) {
      const instance = createTypstRenderer();
      renderer = instance
        .init({ getModule: () => rendererWasm })
        .then(() => instance)
        .catch((cause: unknown) => {
          renderer = undefined;
          throw cause;
        });
    }
    const image = await firstPage(await renderer, bytes);
    signal.throwIfAborted();
    if (cache.size >= 24) cache.delete(cache.keys().next().value!);
    cache.set(key, image);
    return image;
  }

  return {
    load(source: Source, signal: AbortSignal) {
      const combined = AbortSignal.any([signal, lifecycle.signal]);
      const result = pending.then(() => render(source, combined));
      pending = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
    dispose() {
      lifecycle.abort();
      stopWorker();
      cache.clear();
    },
  };
}
