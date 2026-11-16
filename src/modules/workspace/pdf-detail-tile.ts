import type { PDFPageProxy, RenderTask } from 'pdfjs-dist';

export type PdfDetailTile = { x: number; y: number; width: number; height: number };

export const PDF_TILE_SIZE = 768;

export function pdfDetailRatio(): number {
  const devicePixelRatio = typeof window === 'undefined' ? 1 : window.devicePixelRatio;
  if (!Number.isFinite(devicePixelRatio)) return 1;
  return Math.min(3, Math.max(1, devicePixelRatio));
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('Aborted', 'AbortError');
}

function clearCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 0;
  canvas.height = 0;
}

export async function renderPdfDetailTile(
  page: PDFPageProxy,
  cssScale: number,
  ratio: number,
  tile: PdfDetailTile,
  signal: AbortSignal,
): Promise<HTMLCanvasElement> {
  if (!Number.isFinite(cssScale) || cssScale <= 0) throw new Error('Invalid PDF page scale');
  if (!Number.isFinite(ratio) || ratio <= 0 || ratio > 3)
    throw new Error('Invalid PDF detail ratio');
  if (
    !Number.isInteger(tile.x) ||
    !Number.isInteger(tile.y) ||
    !Number.isInteger(tile.width) ||
    !Number.isInteger(tile.height) ||
    tile.x < 0 ||
    tile.y < 0 ||
    tile.width <= 0 ||
    tile.height <= 0 ||
    tile.width > PDF_TILE_SIZE ||
    tile.height > PDF_TILE_SIZE
  )
    throw new Error('Invalid PDF detail tile bounds');
  if (signal.aborted) throw abortReason(signal);

  const viewport = page.getViewport({ scale: cssScale });
  const pagePixelWidth = Math.ceil(viewport.width * ratio);
  const pagePixelHeight = Math.ceil(viewport.height * ratio);
  if (tile.x + tile.width > pagePixelWidth || tile.y + tile.height > pagePixelHeight)
    throw new Error('PDF detail tile exceeds page bounds');

  const canvas = document.createElement('canvas');
  canvas.className = 'pdf-detail-tile';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.width = tile.width;
  canvas.height = tile.height;
  canvas.style.left = `${tile.x / ratio}px`;
  canvas.style.top = `${tile.y / ratio}px`;
  canvas.style.width = `${tile.width / ratio}px`;
  canvas.style.height = `${tile.height / ratio}px`;

  let renderTask: RenderTask | undefined;
  let renderPromise: Promise<void> | undefined;
  const abort = () => renderTask?.cancel();
  signal.addEventListener('abort', abort, { once: true });

  try {
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Canvas is unavailable');
    if (signal.aborted) throw abortReason(signal);

    renderTask = page.render({
      canvas,
      canvasContext: context,
      viewport,
      transform: [ratio, 0, 0, ratio, -tile.x, -tile.y],
    });
    renderPromise = renderTask.promise;
    await renderPromise;
    if (signal.aborted) throw abortReason(signal);
    return canvas;
  } catch (error) {
    abort();
    await Promise.allSettled(renderPromise ? [renderPromise] : []);
    clearCanvas(canvas);
    throw error;
  } finally {
    signal.removeEventListener('abort', abort);
    if (signal.aborted) clearCanvas(canvas);
  }
}
