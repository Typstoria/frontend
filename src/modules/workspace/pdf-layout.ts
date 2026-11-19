export type PageSize = { width: number; height: number };
type Point = { x: number; y: number };
export type PdfAnchor = {
  page: number;
  x: number;
  y: number;
  gap: number;
};
export type PdfView = { zoom: number | null; anchor: PdfAnchor | null };

export function samePdfView(view: PdfView, zoom: number | null, anchor: PdfAnchor | null) {
  if (view.zoom !== zoom) return false;
  const next = view.anchor;
  return (
    next === anchor ||
    (!!next &&
      !!anchor &&
      next.page === anchor.page &&
      next.x === anchor.x &&
      next.y === anchor.y &&
      next.gap === anchor.gap)
  );
}
export type PdfLayout = {
  scale: number;
  maxScale: number;
  width: number;
  height: number;
  pages: { left: number; top: number; width: number; height: number }[];
};
export const MIN_PDF_SCALE = 0.1;
export const MAX_PDF_SCALE = 4;
const PAGE_GAP = 16;

export function pdfLayout(
  sizes: PageSize[],
  viewport: PageSize,
  padding: number,
  zoom: number | null,
): PdfLayout {
  const widest = sizes.reduce((width, page) => Math.max(width, page.width), 0);
  const tallest = sizes.reduce((height, page) => Math.max(height, page.height), 0);
  const fit = Math.max(1, viewport.width - padding * 2) / widest;
  const maxScale = Math.min(MAX_PDF_SCALE, 16_384 / Math.max(widest, tallest));
  const scale = Math.min(zoom ?? fit, maxScale);
  const width = Math.max(viewport.width, widest * scale + padding * 2);
  let top = padding;
  const pages = sizes.map((size) => {
    const page = {
      left: (width - size.width * scale) / 2,
      top,
      width: size.width * scale,
      height: size.height * scale,
    };
    top += page.height + PAGE_GAP;
    return page;
  });
  return { scale, maxScale, width, height: top - PAGE_GAP + padding, pages };
}

export function pageAt(layout: PdfLayout, y: number): number {
  let lo = 0;
  let hi = layout.pages.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const page = layout.pages[mid]!;
    if (page.top + page.height <= y) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function pdfAnchor(layout: PdfLayout, point: Point): PdfAnchor {
  const index = pageAt(layout, point.y);
  const page = layout.pages[index]!;
  return {
    page: index,
    x: Math.max(0, Math.min(1, (point.x - page.left) / page.width)),
    y: Math.max(0, Math.min(1, (point.y - page.top) / page.height)),
    gap: Math.min(0, point.y - page.top),
  };
}

export function scrollForAnchor(
  layout: PdfLayout,
  anchor: PdfAnchor | null,
  point: Point,
  viewport: PageSize,
): Point {
  const page = layout.pages[Math.min(anchor?.page ?? 0, layout.pages.length - 1)]!;
  const x = anchor
    ? page.left + page.width * anchor.x - point.x
    : (layout.width - viewport.width) / 2;
  const y = anchor ? page.top + page.height * anchor.y + anchor.gap - point.y : 0;
  return {
    x: Math.max(0, Math.min(x, layout.width - viewport.width)),
    y: Math.max(0, Math.min(y, layout.height - viewport.height)),
  };
}
