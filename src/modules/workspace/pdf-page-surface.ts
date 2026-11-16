import { TextLayer, type PDFPageProxy, type RenderTask } from 'pdfjs-dist';

const MAX_CANVAS_PIXELS = 2_500_000;
const MAX_CANVAS_SIDE = 4_096;
const MAX_DEVICE_PIXEL_RATIO = 2;

export function pdfPageSize(page: PDFPageProxy): { width: number; height: number } {
  const { width, height } = page.getViewport({ scale: 1 });
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0)
    throw new Error('Invalid PDF page dimensions');
  return { width, height };
}

function getRasterScale(width: number, height: number): number {
  const devicePixelRatio = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
  let scale = Math.min(
    devicePixelRatio,
    MAX_CANVAS_SIDE / width,
    MAX_CANVAS_SIDE / height,
    Math.sqrt(MAX_CANVAS_PIXELS / width / height),
  );
  if (!Number.isFinite(scale) || scale <= 0) throw new Error('Invalid PDF raster scale');

  // Ceil the backing dimensions without exceeding either canvas bound.
  while (
    Math.ceil(width * scale) > MAX_CANVAS_SIDE ||
    Math.ceil(height * scale) > MAX_CANVAS_SIDE ||
    Math.ceil(width * scale) * Math.ceil(height * scale) > MAX_CANVAS_PIXELS
  ) {
    scale *= 0.999;
  }
  return scale;
}

function clearSurface(surface: HTMLElement): void {
  const canvas = surface.querySelector('canvas');
  if (canvas) {
    canvas.width = 0;
    canvas.height = 0;
  }
  surface.querySelector('.pdf-text-layer')?.replaceChildren();
}

export function releasePdfPageSurface(surface: HTMLElement): void {
  clearSurface(surface);
}

export async function renderPdfPage(
  page: PDFPageProxy,
  cssScale: number,
  signal: AbortSignal,
): Promise<HTMLElement> {
  if (!Number.isFinite(cssScale) || cssScale <= 0) throw new Error('Invalid PDF page scale');
  if (signal.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');

  pdfPageSize(page);
  const viewport = page.getViewport({ scale: cssScale });
  if (
    !Number.isFinite(viewport.width) ||
    viewport.width <= 0 ||
    !Number.isFinite(viewport.height) ||
    viewport.height <= 0
  )
    throw new Error('Invalid PDF page dimensions');

  const surface = document.createElement('div');
  surface.className = 'pdf-page-content';
  surface.style.width = `${viewport.width}px`;
  surface.style.height = `${viewport.height}px`;

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  const rasterScale = getRasterScale(viewport.width, viewport.height);
  canvas.width = Math.ceil(viewport.width * rasterScale);
  canvas.height = Math.ceil(viewport.height * rasterScale);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;

  const textContainer = document.createElement('div');
  textContainer.className = 'pdf-text-layer';
  textContainer.setAttribute('aria-label', 'Текст сторінки');
  textContainer.style.width = `${viewport.width}px`;
  textContainer.style.height = `${viewport.height}px`;
  textContainer.style.setProperty('--total-scale-factor', String(cssScale));
  surface.append(canvas, textContainer);

  let renderTask: RenderTask | undefined;
  let textLayer: TextLayer | undefined;
  let renderPromise: Promise<void> | undefined;
  let textPromise: Promise<unknown> | undefined;
  const abort = () => {
    renderTask?.cancel();
    textLayer?.cancel();
  };
  signal.addEventListener('abort', abort, { once: true });

  try {
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Canvas is unavailable');

    const rasterViewport = page.getViewport({ scale: cssScale * rasterScale });
    renderTask = page.render({ canvas, canvasContext: context, viewport: rasterViewport });
    renderPromise = renderTask.promise;
    textLayer = new TextLayer({
      textContentSource: page.streamTextContent(),
      container: textContainer,
      viewport,
    });

    textPromise = textLayer.render();
    await Promise.all([renderPromise, textPromise]);
    if (signal.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
    return surface;
  } catch (error) {
    abort();
    await Promise.allSettled([renderPromise, textPromise]);
    clearSurface(surface);
    throw error;
  } finally {
    signal.removeEventListener('abort', abort);
    if (signal.aborted) clearSurface(surface);
  }
}
