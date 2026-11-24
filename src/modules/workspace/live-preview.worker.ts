import initCompiler, {
  TypstCompilerBuilder,
  type TypstCompiler,
} from '@myriaddreamin/typst-ts-web-compiler';
import wasmUrl from '@myriaddreamin/typst-ts-web-compiler/wasm?url';
import { typstFontUrls } from './live-preview-fonts';
import type {
  LivePreviewCompileRequest,
  LivePreviewDiagnostic,
  LivePreviewResponse,
} from './live-preview-protocol';

const MAX_CHANGES_PER_REQUEST = 1000;
const MAX_PATH_LENGTH = 2048;
const MAX_TOTAL_SOURCE_BYTES = 20 * 1024 * 1024;
const textEncoder = new TextEncoder();

const worker = self as unknown as {
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<LivePreviewCompileRequest>) => void,
  ): void;
  postMessage(message: LivePreviewResponse, transfer?: Transferable[]): void;
};

const files = new Map<string, Uint8Array>();
let compiler: TypstCompiler | undefined;
let compilerReady: Promise<TypstCompiler> | undefined;
let fontVersion = 0;
let initializedFontVersion = -1;
let defaultFonts: Promise<Uint8Array[]> | undefined;
let latestGeneration = -1;
let workQueue = Promise.resolve();

function normalizePath(path: string): string | undefined {
  if (!path || path.length > MAX_PATH_LENGTH || path.includes('\\')) return;

  const segments: string[] = [];
  for (const segment of path.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (segments.length === 0) return;
      segments.pop();
      continue;
    }
    segments.push(segment);
  }

  if (segments.length === 0) return;
  return `/${segments.join('/')}`;
}

function isFont(path: string) {
  return /\.(?:ttf|otf|ttc)$/i.test(path);
}

// The compiler reports zero-based Unicode scalar columns; the editor uses UTF-16.
function diagnosticRange(range: unknown, lines: string[]): LivePreviewDiagnostic['range'] {
  const match = typeof range === 'string' && /^(\d+):(\d+)-(\d+):(\d+)$/.exec(range);
  if (!match) return;
  const [startLine, startColumn, endLine, endColumn] = match.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
  ];
  function utf16(line: number, column: number) {
    if (!Number.isSafeInteger(column) || lines[line] === undefined) return;
    let offset = 0;
    for (const char of lines[line]) {
      if (column-- === 0) return offset;
      offset += char.length;
    }
    if (column === 0) return offset;
  }
  const start = utf16(startLine, startColumn);
  const end = utf16(endLine, endColumn);
  if (
    start === undefined ||
    end === undefined ||
    startLine > endLine ||
    (startLine === endLine && start > end)
  )
    return;
  return { start: { line: startLine, character: start }, end: { line: endLine, character: end } };
}

function diagnosticsFrom(value: unknown): LivePreviewDiagnostic[] {
  if (!Array.isArray(value)) return [];
  const sourceLines = new Map<string, string[]>();
  return value.slice(0, 50).flatMap((item): LivePreviewDiagnostic[] => {
    if (!item || typeof item !== 'object' || typeof item.message !== 'string') return [];
    const severity = String(item.severity).toLowerCase();
    if (severity !== 'warning' && severity !== 'error') return [];
    const path =
      !item.package && typeof item.path === 'string'
        ? normalizePath(item.path)?.slice(1)
        : undefined;
    const source = path && typeof item.range === 'string' ? files.get('/' + path) : undefined;
    let range: LivePreviewDiagnostic['range'];
    if (path && source) {
      let lines = sourceLines.get(path);
      if (!lines) {
        lines = new TextDecoder('utf-8', { ignoreBOM: true }).decode(source).split(/\r\n?|\n/u);
        sourceLines.set(path, lines);
      }
      range = diagnosticRange(item.range, lines);
    }
    return [
      {
        message: item.message.slice(0, 600),
        severity,
        ...(path ? { path } : {}),
        ...(range ? { range } : {}),
      },
    ];
  });
}

function send(response: LivePreviewResponse): void {
  if (response.generation !== latestGeneration) return;
  if (response.type === 'compiled') {
    worker.postMessage(response, [response.document.buffer]);
    return;
  }
  worker.postMessage(response);
}

async function getCompiler(): Promise<TypstCompiler> {
  // A warm-up may have started before the first request supplied project fonts.
  if (compilerReady) await compilerReady;
  if (compiler && initializedFontVersion === fontVersion) return compiler;

  const old = compiler;
  compiler = undefined;
  const version = fontVersion;
  const fonts = [...files].filter(([path]) => isFont(path)).map(([, content]) => content);
  compilerReady = (async () => {
    old?.free();
    defaultFonts ??= Promise.all(
      typstFontUrls.map(async (url) => {
        const response = await fetch(url, { mode: 'same-origin' });
        if (!response.ok) throw new Error('Typst font unavailable');
        return new Uint8Array(await response.arrayBuffer());
      }),
    );
    const [, builtInFonts] = await Promise.all([
      initCompiler({ module_or_path: wasmUrl }),
      defaultFonts,
    ]);
    const builder = new TypstCompilerBuilder();
    try {
      for (const bytes of [...builtInFonts, ...fonts]) await builder.add_raw_font(bytes);
    } catch (error) {
      builder.free();
      throw error;
    }
    const instance = await builder.build();
    for (const [path, content] of files) instance.map_shadow(path, content);
    compiler = instance;
    initializedFontVersion = version;
    return instance;
  })();
  try {
    return await compilerReady;
  } finally {
    compilerReady = undefined;
  }
}

function isCompileRequest(value: unknown): value is LivePreviewCompileRequest {
  if (!value || typeof value !== 'object') return false;
  const request = value as Partial<LivePreviewCompileRequest>;
  return (
    request.type === 'compile' &&
    Number.isSafeInteger(request.generation) &&
    (request.generation as number) >= 0 &&
    typeof request.entrypoint === 'string' &&
    Array.isArray(request.changes)
  );
}

async function compileRequest(request: LivePreviewCompileRequest): Promise<void> {
  const mainFilePath = normalizePath(request.entrypoint);
  const unavailable = () =>
    send({ type: 'failed', generation: request.generation, reason: 'unavailable' });
  if (!mainFilePath || request.changes.length > MAX_CHANGES_PER_REQUEST) return unavailable();

  try {
    const next = new Map(files);
    for (const change of request.changes) {
      const path = typeof change?.path === 'string' ? normalizePath(change.path) : undefined;
      if (!path) return unavailable();
      const content = change.content;
      if (content === null) next.delete(path);
      else if (typeof content === 'string') next.set(path, textEncoder.encode(content));
      else if (content instanceof Uint8Array) next.set(path, content);
      else return unavailable();
    }
    let size = 0;
    for (const bytes of next.values()) size += bytes.byteLength;
    if (size > MAX_TOTAL_SOURCE_BYTES || next.size > 500 || !next.has(mainFilePath))
      return unavailable();
    for (const path of files.keys()) {
      if (next.has(path)) continue;
      if (isFont(path)) fontVersion++;
      compiler?.unmap_shadow(path);
      files.delete(path);
    }
    for (const [path, content] of next) {
      if (files.get(path) === content) continue;
      if (isFont(path)) fontVersion++;
      compiler?.map_shadow(path, content);
      files.set(path, content);
    }
    const currentCompiler = await getCompiler();
    const world = currentCompiler.snapshot('/', mainFilePath, []);
    let result: { result?: Uint8Array; diagnostics?: unknown } | undefined;
    try {
      // The bindgen API uses 0 for vector output and 3 for complete diagnostics.
      result = world.get_artifact(0, 3);
    } finally {
      world.free();
    }
    const diagnostics = diagnosticsFrom(result?.diagnostics);
    if (
      !(result?.result instanceof Uint8Array) ||
      diagnostics.some((diagnostic) => diagnostic.severity === 'error')
    ) {
      send({
        type: 'failed',
        generation: request.generation,
        reason: 'document',
        diagnostics: diagnostics.length
          ? diagnostics
          : [{ message: 'Не вдалося скомпілювати чернетку.', severity: 'error' }],
      });
      return;
    }

    send({
      type: 'compiled',
      generation: request.generation,
      document: result.result,
      ...(diagnostics.length > 0 ? { diagnostics } : {}),
    });
  } catch {
    unavailable();
  }
}

worker.addEventListener('message', (event) => {
  const request: unknown = event.data;
  if (!isCompileRequest(request)) return;
  latestGeneration = request.generation;
  workQueue = workQueue
    .then(() => compileRequest(request))
    .catch(() => {
      send({ type: 'failed', generation: request.generation, reason: 'unavailable' });
    });
});

void getCompiler().catch(() => undefined);
