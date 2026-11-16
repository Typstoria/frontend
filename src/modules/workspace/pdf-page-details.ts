import type { PDFPageProxy } from 'pdfjs-dist';
import { PDF_TILE_SIZE, pdfDetailRatio, renderPdfDetailTile } from './pdf-detail-tile';
import type { PdfDetailTile } from './pdf-detail-tile';

type Bounds = { left: number; top: number; width: number; height: number };

export type PdfDetailPage = {
  index: number;
  bounds: Bounds;
  scale: number;
  surface: HTMLElement;
  proxy: PDFPageProxy;
};

type Tile = {
  key: string;
  page: PdfDetailPage;
  ratio: number;
  bounds: PdfDetailTile;
  distance: number;
};
type Entry = { tile: Tile; canvas?: HTMLCanvasElement; failed?: boolean };

const MAX_VISIBLE_PIXELS = 8_000_000;
const MAX_CACHED_TILES = 24;

function visibleTiles(pages: PdfDetailPage[], viewport: Bounds): Tile[] {
  const ratio = Math.min(
    pdfDetailRatio(),
    Math.sqrt(MAX_VISIBLE_PIXELS / (viewport.width * viewport.height)),
  );
  const tiles: Tile[] = [];
  for (const page of pages) {
    if (Number(page.surface.dataset.rasterScale) >= ratio * 0.98) continue;
    const { left, top } = page.bounds;
    const { width, height } = page.proxy.getViewport({ scale: page.scale });
    const x0 = Math.floor(Math.max(0, viewport.left - left) * ratio);
    const y0 = Math.floor(Math.max(0, viewport.top - top) * ratio);
    const x1 = Math.ceil(Math.min(width, viewport.left + viewport.width - left) * ratio);
    const y1 = Math.ceil(Math.min(height, viewport.top + viewport.height - top) * ratio);
    if (x1 <= x0 || y1 <= y0) continue;
    const right = Math.ceil(width * ratio);
    const bottom = Math.ceil(height * ratio);
    for (let y = Math.floor(y0 / PDF_TILE_SIZE) * PDF_TILE_SIZE; y < y1; y += PDF_TILE_SIZE) {
      for (let x = Math.floor(x0 / PDF_TILE_SIZE) * PDF_TILE_SIZE; x < x1; x += PDF_TILE_SIZE) {
        const tileWidth = Math.min(right - x, PDF_TILE_SIZE);
        const tileHeight = Math.min(bottom - y, PDF_TILE_SIZE);
        const centerX = left + (x + tileWidth / 2) / ratio;
        const centerY = top + (y + tileHeight / 2) / ratio;
        tiles.push({
          key: `${page.index}:${ratio}:${x}:${y}`,
          page,
          ratio,
          bounds: { x, y, width: tileWidth, height: tileHeight },
          distance: Math.hypot(
            centerX - (viewport.left + viewport.width / 2),
            centerY - (viewport.top + viewport.height / 2),
          ),
        });
      }
    }
  }
  return tiles.sort((a, b) => a.distance - b.distance).slice(0, MAX_CACHED_TILES);
}

function removeCanvas(canvas: HTMLCanvasElement) {
  canvas.remove();
  canvas.width = 0;
  canvas.height = 0;
}

/** Renders at most one detail tile at a time and retains only the visible tile set. */
export function createPdfPageDetails() {
  const entries = new Map<string, Entry>();
  let active: { entry: Entry; controller: AbortController } | undefined;

  function renderNext() {
    if (active) return;
    const entry = [...entries.values()].find((candidate) => !candidate.canvas && !candidate.failed);
    if (!entry) return;
    const controller = new AbortController();
    const { signal } = controller;
    active = { entry, controller };
    const { tile } = entry;
    void (async () => {
      try {
        const canvas = await renderPdfDetailTile(
          tile.page.proxy,
          tile.page.scale,
          tile.ratio,
          tile.bounds,
          signal,
        );
        if (signal.aborted || !tile.page.surface.isConnected) {
          removeCanvas(canvas);
          if (!signal.aborted) entry.failed = true;
          return;
        }
        tile.page.surface.insertBefore(canvas, tile.page.surface.querySelector('.pdf-text-layer'));
        entry.canvas = canvas;
      } catch {
        // Keep the existing page readable if optional detail rendering fails.
        if (!signal.aborted) entry.failed = true;
      } finally {
        active = undefined;
        renderNext();
      }
    })();
  }

  function sync(pages: PdfDetailPage[], viewport: Bounds) {
    const wanted = visibleTiles(pages, viewport);
    const next = new Map<string, Entry>();
    for (const tile of wanted) {
      const entry = entries.get(tile.key);
      next.set(tile.key, entry?.tile.page.surface === tile.page.surface ? entry : { tile });
    }
    for (const [key, entry] of entries) {
      if (next.get(key) === entry) continue;
      if (entry === active?.entry) active.controller.abort();
      if (entry.canvas) removeCanvas(entry.canvas);
    }
    entries.clear();
    for (const [key, entry] of next) entries.set(key, entry);
    renderNext();
  }

  function clear() {
    active?.controller.abort();
    entries.forEach(({ canvas }) => {
      if (canvas) removeCanvas(canvas);
    });
    entries.clear();
  }

  return { sync, clear };
}
