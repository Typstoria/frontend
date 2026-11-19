<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
  type PDFPageProxy,
} from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  MAX_PDF_SCALE,
  MIN_PDF_SCALE,
  pageAt,
  pdfAnchor,
  pdfLayout,
  samePdfView,
  scrollForAnchor,
  type PageSize,
  type PdfAnchor,
  type PdfLayout,
  type PdfView,
} from './pdf-layout';
import { pdfPageSize, releasePdfPageSurface, renderPdfPage } from './pdf-page-surface';
import { createPdfPageDetails, type PdfDetailPage } from './pdf-page-details';

const props = defineProps<{ pdf: Blob; view?: PdfView | undefined }>();
const emit = defineEmits<{
  displayed: [pdf: Blob];
  viewChange: [view: PdfView];
}>();
type DocumentTask = PDFDocumentLoadingTask;
type LoadedPdf = { task: DocumentTask; doc: PDFDocumentProxy; sizes: PageSize[]; blob: Blob };
type PreparedPage = { page: PDFPageProxy; surface: HTMLElement };
type PageSlot = {
  node: HTMLDivElement;
  surface?: HTMLElement;
  scale?: number;
  page?: PDFPageProxy;
};
type PageRender = { index: number; controller: AbortController };
type Point = { x: number; y: number };

const frame = ref<HTMLElement | null>(null);
const stack = ref<HTMLElement | null>(null);
const loading = ref(true);
const error = ref('');
const pageCount = ref(0);
const pageNumber = ref(1);
const zoom = ref<number | null>(null);
const scale = ref(1);
const maxScale = ref(MAX_PDF_SCALE);
const zoomPercent = computed(() => Math.round(scale.value * 100));
let current: LoadedPdf | undefined;
let layout: PdfLayout | undefined;
let anchor: PdfAnchor | null = props.view?.anchor ?? null;
zoom.value =
  props.view?.zoom == null
    ? null
    : Math.max(MIN_PDF_SCALE, Math.min(MAX_PDF_SCALE, props.view.zoom));
let lastPosition: Point | undefined;
let pending:
  | { controller: AbortController; task?: DocumentTask; pdf?: LoadedPdf; preparing: boolean }
  | undefined;
const slots = new Map<number, PageSlot>();
const details = createPdfPageDetails();
let pageRender: PageRender | undefined;
let resizeObserver: ResizeObserver | undefined;
let frameRequest = 0;
let disposed = false;
let viewportWidth = 0;
let viewportHeight = 0;
let renderedZoom: number | null = null;
let pinch: { distance: number; scale: number; anchor: PdfAnchor } | undefined;

function viewSize(): PageSize | null {
  const element = frame.value;
  return element?.clientWidth && element.clientHeight
    ? { width: element.clientWidth, height: element.clientHeight }
    : null;
}

function makeLayout(pdf: LoadedPdf, size: PageSize) {
  return pdfLayout(pdf.sizes, size, size.width <= 480 ? 8 : 16, zoom.value);
}

function readAnchor(point: Point): PdfAnchor | null {
  const element = frame.value;
  if (!layout || !element || !viewSize()) return anchor;
  return pdfAnchor(layout, { x: element.scrollLeft + point.x, y: element.scrollTop + point.y });
}

function updatePageIndicator() {
  const element = frame.value;
  if (!element || !layout) return;
  const maxScroll = element.scrollHeight - element.clientHeight;
  const atBottom = maxScroll > 0 && element.scrollTop >= maxScroll - 1;
  pageNumber.value = atBottom ? layout.pages.length : pageAt(layout, element.scrollTop) + 1;
}

function rememberReadingPoint() {
  const element = frame.value;
  if (!element || !viewSize()) return;
  anchor = readAnchor({ x: element.clientWidth / 2, y: 0 });
}

function publishView() {
  emit('viewChange', {
    zoom: zoom.value,
    anchor: anchor ? { ...anchor } : null,
  });
}

function applyLayout(next: PdfLayout, size: PageSize, position: Point) {
  const element = frame.value!;
  const surface = stack.value!;
  layout = next;
  scale.value = next.scale;
  maxScale.value = next.maxScale;
  viewportWidth = size.width;
  viewportHeight = size.height;
  renderedZoom = zoom.value;
  surface.style.width = `${next.width}px`;
  surface.style.height = `${next.height}px`;
  element.scrollLeft = position.x;
  element.scrollTop = position.y;
  // A wider pane can clamp scrollLeft to zero. Retain the preferred point so
  // returning to a narrower pane restores the same part of the page.
  lastPosition = { x: element.scrollLeft, y: element.scrollTop };
  updatePageIndicator();
}

function removeSlot(slot: PageSlot, index: number) {
  if (pageRender?.index !== index) slot.page?.cleanup();
  if (slot.surface) releasePdfPageSurface(slot.surface);
  slot.node.remove();
}

function clearSlots() {
  details.clear();
  pageRender?.controller.abort();
  slots.forEach(removeSlot);
  slots.clear();
}

function placeSurface(slot: PageSlot, surface: HTMLElement, pageScale: number) {
  if (slot.surface) releasePdfPageSurface(slot.surface);
  slot.node.replaceChildren(surface);
  slot.surface = surface;
  slot.scale = pageScale;
}

function syncPages(prepared?: Map<number, PreparedPage>) {
  const element = frame.value;
  const surface = stack.value;
  const pdf = current;
  const geometry = layout;
  if (!element || !surface || !pdf || !geometry || !viewSize()) return;
  const top = element.scrollTop;
  const bottom = top + element.clientHeight;
  const visibleFirst = pageAt(geometry, top);
  const visibleLast = pageAt(geometry, bottom);
  const first = Math.max(0, visibleFirst - 1);
  const last = Math.min(geometry.pages.length - 1, visibleLast + 1);
  if (pageRender && (pageRender.index < first || pageRender.index > last))
    pageRender.controller.abort();
  for (const [index, slot] of slots) {
    if (index < first || index > last) {
      removeSlot(slot, index);
      slots.delete(index);
    }
  }

  let nextRender: number | undefined;
  const detailedPages: PdfDetailPage[] = [];
  for (let index = first; index <= last; index++) {
    const page = geometry.pages[index]!;
    let slot = slots.get(index);
    if (!slot) {
      const node = document.createElement('div');
      node.className = 'pdf-page';
      node.dataset.pageNumber = String(index + 1);
      node.setAttribute('role', 'group');
      node.setAttribute('aria-label', `Сторінка ${index + 1}`);
      const after = Array.from(surface.children).find(
        (child) => Number((child as HTMLElement).dataset.pageNumber) > index + 1,
      );
      surface.insertBefore(node, after ?? null);
      slot = { node };
      slots.set(index, slot);
    }
    slot.node.style.left = `${page.left}px`;
    slot.node.style.top = `${page.top}px`;
    slot.node.style.width = `${page.width}px`;
    slot.node.style.height = `${page.height}px`;
    const ready = prepared?.get(index);
    if (ready) {
      slot.page = ready.page;
      placeSurface(slot, ready.surface, geometry.scale);
      prepared?.delete(index);
    }
    if (slot.surface && slot.scale !== geometry.scale)
      slot.surface.style.transform = `scale(${geometry.scale / slot.scale!})`;
    if (
      slot.surface &&
      slot.page &&
      slot.scale === geometry.scale &&
      index >= visibleFirst &&
      index <= visibleLast
    ) {
      detailedPages.push({
        index,
        bounds: page,
        scale: geometry.scale,
        surface: slot.surface,
        proxy: slot.page,
      });
    }
    if (
      slot.scale !== geometry.scale &&
      (nextRender === undefined ||
        (nextRender < visibleFirst && index >= visibleFirst && index <= visibleLast))
    )
      nextRender = index;
  }

  details.sync(detailedPages, {
    left: element.scrollLeft,
    top,
    width: element.clientWidth,
    height: element.clientHeight,
  });

  if (!pageRender && nextRender !== undefined) {
    const index = nextRender;
    const slot = slots.get(index)!;
    const request = { index, controller: new AbortController() };
    pageRender = request;
    const { signal } = request.controller;
    void (async () => {
      try {
        const page = await pdf.doc.getPage(index + 1);
        slot.page = page;
        signal.throwIfAborted();
        const content = await renderPdfPage(page, geometry.scale, signal);
        if (signal.aborted || current !== pdf || layout !== geometry || slots.get(index) !== slot) {
          releasePdfPageSurface(content);
          return;
        }
        placeSurface(slot, content, geometry.scale);
      } catch {
        if (!signal.aborted && slots.get(index) === slot) {
          slot.scale = geometry.scale;
          if (!slot.surface) {
            const message = document.createElement('p');
            message.className = 'pdf-page-error';
            message.textContent = 'Не вдалося відобразити сторінку.';
            message.setAttribute('role', 'alert');
            slot.node.replaceChildren(message);
          }
        }
      } finally {
        if (slots.get(index) !== slot) slot.page?.cleanup();
        if (pageRender === request) pageRender = undefined;
        scheduleFrame();
      }
    })();
  }
}

function refreshLayout(size: PageSize) {
  if (!current) return;
  const next = makeLayout(current, size);
  pageRender?.controller.abort();
  const point = { x: size.width / 2, y: 0 };
  applyLayout(next, size, scrollForAnchor(next, anchor, point, size));
}

function scheduleFrame() {
  if (disposed || frameRequest) return;
  frameRequest = requestAnimationFrame(() => {
    frameRequest = 0;
    const size = viewSize();
    if (!size) {
      details.clear();
      return;
    }
    if (
      size.width !== viewportWidth ||
      size.height !== viewportHeight ||
      zoom.value !== renderedZoom
    )
      refreshLayout(size);
    syncPages();
    const attempt = pending;
    if (attempt?.pdf && !attempt.preparing) void prepareReplacement(attempt, attempt.pdf);
  });
}

function onScroll() {
  const element = frame.value;
  if (!element || !viewSize()) return;
  const position = { x: element.scrollLeft, y: element.scrollTop };
  if (position.x !== lastPosition?.x || position.y !== lastPosition.y) {
    rememberReadingPoint();
    lastPosition = position;
    if (layout && current) publishView();
  }
  updatePageIndicator();
  scheduleFrame();
}

function setZoom(value: number | null, point?: Point, remembered?: PdfAnchor) {
  if (!current || !layout) return;
  const size = viewSize();
  if (!size) return;
  const origin = point ?? { x: size.width / 2, y: 0 };
  const keep = remembered ?? (point ? readAnchor(origin) : (anchor ?? readAnchor(origin)));
  anchor = keep ? { ...keep } : null;
  zoom.value = value === null ? null : Math.max(MIN_PDF_SCALE, Math.min(MAX_PDF_SCALE, value));
  const next = makeLayout(current, size);
  pageRender?.controller.abort();
  applyLayout(next, size, scrollForAnchor(next, keep, origin, size));
  if (point) rememberReadingPoint();
  publishView();
  syncPages();
  scheduleFrame();
}

function stepZoom(factor: number) {
  setZoom(scale.value * factor);
}

function onWheel(event: WheelEvent) {
  if ((!event.ctrlKey && !event.metaKey) || !layout || !frame.value) return;
  event.preventDefault();
  const rect = frame.value.getBoundingClientRect();
  const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 120 : 1);
  setZoom(scale.value * Math.exp(-pixels * 0.003), {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  });
}

function pinchPosition(event: TouchEvent) {
  if (!frame.value || event.touches.length !== 2) return null;
  const [a, b] = [event.touches[0]!, event.touches[1]!];
  const rect = frame.value.getBoundingClientRect();
  const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  return {
    distance,
    point: {
      x: (a.clientX + b.clientX) / 2 - rect.left,
      y: (a.clientY + b.clientY) / 2 - rect.top,
    },
  };
}

function onTouchStart(event: TouchEvent) {
  const touch = pinchPosition(event);
  if (!touch?.distance || !layout) return;
  const keep = readAnchor(touch.point);
  if (keep) pinch = { distance: touch.distance, scale: scale.value, anchor: keep };
}

function onTouchMove(event: TouchEvent) {
  const touch = pinchPosition(event);
  if (!touch || !pinch) return;
  if (event.cancelable) event.preventDefault();
  setZoom((pinch.scale * touch.distance) / pinch.distance, touch.point, pinch.anchor);
}

function endPinch() {
  pinch = undefined;
}

async function measuredPages(doc: PDFDocumentProxy, signal: AbortSignal) {
  if (doc.numPages < 1) throw new Error('PDF has no pages');
  const sizes: PageSize[] = [];
  let next = 0;
  async function measure() {
    while (next < doc.numPages) {
      signal.throwIfAborted();
      const index = next++;
      const page = await doc.getPage(index + 1);
      sizes[index] = pdfPageSize(page);
    }
  }
  await Promise.all(Array.from({ length: Math.min(doc.numPages, 6) }, measure));
  return sizes;
}

function destroyTask(task: DocumentTask | undefined) {
  void task?.destroy().catch(() => {});
}

function openFailure(attempt: NonNullable<typeof pending>) {
  if (pending !== attempt) return;
  pending = undefined;
  attempt.controller.abort();
  destroyTask(attempt.task);
  loading.value = false;
  error.value = 'Не вдалося відобразити PDF.';
}

function releasePreparedPage({ page, surface }: PreparedPage) {
  page.cleanup();
  releasePdfPageSurface(surface);
}

// Prepare the actual visible pages while the old document remains interactive.
async function prepareReplacement(attempt: NonNullable<typeof pending>, pdf: LoadedPdf) {
  attempt.preparing = true;
  const prepared = new Map<number, PreparedPage>();
  let stagedLayout: PdfLayout | undefined;
  let stagedWidth = 0;
  let stagedZoom: number | null = null;
  const { signal } = attempt.controller;
  try {
    while (!signal.aborted && pending === attempt) {
      const size = viewSize();
      if (!size) return;
      if (!stagedLayout || stagedWidth !== size.width || stagedZoom !== zoom.value) {
        const next = makeLayout(pdf, size);
        if (stagedLayout && stagedLayout.scale !== next.scale) {
          prepared.forEach(releasePreparedPage);
          prepared.clear();
        }
        stagedLayout = next;
        stagedWidth = size.width;
        stagedZoom = zoom.value;
      }
      const next = stagedLayout;
      const point = { x: size.width / 2, y: 0 };
      const position = scrollForAnchor(next, anchor, point, size);
      const first = pageAt(next, position.y);
      const last = pageAt(next, position.y + size.height);
      for (const [index, preparedPage] of prepared) {
        if (index < first || index > last) {
          releasePreparedPage(preparedPage);
          prepared.delete(index);
        }
      }
      let missing = first;
      while (prepared.has(missing)) missing++;
      if (missing <= last) {
        const page = await pdf.doc.getPage(missing + 1);
        try {
          signal.throwIfAborted();
          const surface = await renderPdfPage(page, next.scale, signal);
          prepared.set(missing, { page, surface });
        } catch (error) {
          page.cleanup();
          throw error;
        }
        continue;
      }

      const old = current;
      clearSlots();
      current = pdf;
      pending = undefined;
      pageCount.value = pdf.sizes.length;
      loading.value = false;
      if (anchor && anchor.page >= pdf.sizes.length)
        anchor = { ...anchor, page: pdf.sizes.length - 1 };
      applyLayout(next, size, position);
      if (!anchor) rememberReadingPoint();
      syncPages(prepared);
      emit('displayed', pdf.blob);
      destroyTask(old?.task);
    }
  } catch {
    if (!signal.aborted) openFailure(attempt);
  } finally {
    attempt.preparing = false;
    prepared.forEach(releasePreparedPage);
  }
}

async function openPdf(blob: Blob) {
  pending?.controller.abort();
  destroyTask(pending?.task);
  const attempt: NonNullable<typeof pending> = {
    controller: new AbortController(),
    preparing: false,
  };
  pending = attempt;
  const { signal } = attempt.controller;
  loading.value = true;
  error.value = '';
  try {
    const data = await blob.arrayBuffer();
    signal.throwIfAborted();
    GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    const task = getDocument({ data });
    attempt.task = task;
    const doc = await task.promise;
    const sizes = await measuredPages(doc, signal);
    signal.throwIfAborted();
    attempt.pdf = { task, doc, sizes, blob };
    scheduleFrame();
  } catch {
    if (!signal.aborted) openFailure(attempt);
  }
}

onMounted(() => {
  resizeObserver = new ResizeObserver(scheduleFrame);
  if (frame.value) resizeObserver.observe(frame.value);
  void openPdf(props.pdf);
});

watch(
  () => props.pdf,
  (pdf) => void openPdf(pdf),
);

watch(
  () => props.view,
  (view) => {
    if (!view || samePdfView(view, zoom.value, anchor)) return;
    zoom.value = view.zoom;
    anchor = view.anchor;
    const size = viewSize();
    if (size && layout) {
      if (
        zoom.value !== renderedZoom ||
        size.width !== viewportWidth ||
        size.height !== viewportHeight
      )
        refreshLayout(size);
      else
        applyLayout(
          layout,
          size,
          scrollForAnchor(layout, anchor, { x: size.width / 2, y: 0 }, size),
        );
    }
    scheduleFrame();
  },
  { flush: 'sync' },
);

onBeforeUnmount(() => {
  disposed = true;
  resizeObserver?.disconnect();
  cancelAnimationFrame(frameRequest);
  clearSlots();
  pending?.controller.abort();
  destroyTask(pending?.task);
  destroyTask(current?.task);
});
</script>

<template>
  <section class="pdf-document" aria-label="Перегляд PDF">
    <div v-if="error" class="pdf-message pdf-message-error" role="alert">
      <p>{{ error }}</p>
      <button class="button button-secondary" @click="openPdf(pdf)">Спробувати ще раз</button>
    </div>
    <div
      ref="frame"
      class="pdf-page-frame"
      tabindex="0"
      aria-label="Сторінки PDF"
      :aria-busy="loading"
      @scroll.passive="onScroll"
      @wheel="onWheel"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="endPinch"
      @touchcancel="endPinch"
    >
      <div ref="stack" class="pdf-page-stack"></div>
      <p v-if="!pageCount && loading" class="pdf-message" role="status">Відкриваємо PDF…</p>
    </div>
    <div v-if="pageCount" class="pdf-controls" role="group" aria-label="Масштаб PDF">
      <span class="pdf-page-indicator" role="status" aria-label="Поточна сторінка"
        >{{ pageNumber }} / {{ pageCount }}</span
      >
      <button
        type="button"
        class="file-icon-button"
        title="Зменшити масштаб"
        aria-label="Зменшити масштаб"
        :disabled="scale <= MIN_PDF_SCALE"
        @click="stepZoom(1 / 1.2)"
      >
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h12" /></svg>
      </button>
      <span class="pdf-zoom-value" role="status">{{ zoomPercent }}%</span>
      <button
        type="button"
        class="file-icon-button"
        title="Збільшити масштаб"
        aria-label="Збільшити масштаб"
        :disabled="scale >= maxScale"
        @click="stepZoom(1.2)"
      >
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h12m-6-6v12" /></svg>
      </button>
      <button
        type="button"
        class="button button-quiet pdf-fit"
        :aria-pressed="zoom === null"
        @click="setZoom(null)"
      >
        За шириною
      </button>
    </div>
  </section>
</template>

<style scoped>
.pdf-document {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: #edf0f2;
}
.pdf-page-frame {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  overflow-anchor: none;
  scrollbar-gutter: stable;
  touch-action: pan-x pan-y;
}
.pdf-page-frame:focus-visible {
  outline-offset: -2px;
}
.pdf-page-stack {
  position: relative;
}
:deep(.pdf-page) {
  position: absolute;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 1px 5px rgb(20 32 40 / 18%);
}
:deep(.pdf-page-content) {
  position: relative;
  transform-origin: 0 0;
}
:deep(.pdf-page canvas) {
  display: block;
  max-width: none;
}
:deep(.pdf-detail-tile) {
  position: absolute;
  pointer-events: none;
}
:deep(.pdf-text-layer) {
  position: absolute;
  inset: 0;
  overflow: hidden;
  line-height: 1;
  letter-spacing: normal;
  word-spacing: normal;
  text-align: initial;
  transform-origin: 0 0;
  user-select: text;
  color-scheme: only light;
}

:deep(.pdf-text-layer span),
:deep(.pdf-text-layer br) {
  position: absolute;
  color: transparent;
  white-space: pre;
  cursor: text;
  transform-origin: 0 0;
  user-select: text;
}

:deep(.pdf-text-layer > :not(.markedContent)),
:deep(.pdf-text-layer .markedContent span:not(.markedContent)) {
  z-index: 1;
  font-size: calc(var(--total-scale-factor) * var(--font-height));
  transform: rotate(var(--rotate, 0deg)) scaleX(var(--scale-x, 1));
}

:deep(.pdf-text-layer .markedContent) {
  display: contents;
}

:deep(.pdf-text-layer ::selection) {
  background: rgb(0 100 220 / 24%);
  color: transparent;
}

.pdf-message,
:deep(.pdf-page-error) {
  padding: 12px;
  margin: 0;
  text-align: center;
  color: var(--color-muted);
}
.pdf-message-error {
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}
.pdf-message-error p {
  margin: 0 0 6px;
}
.pdf-controls {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 44px;
  padding: 2px 6px;
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 13px;
  white-space: nowrap;
}
.pdf-controls .file-icon-button svg {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
}
.pdf-page-indicator,
.pdf-zoom-value {
  min-width: 44px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.pdf-fit {
  min-height: 34px;
  padding: 4px 8px;
  font-size: inherit;
}
.pdf-fit[aria-pressed='true'] {
  color: var(--color-primary);
  background: #e8f2f6;
}
@media (max-width: 720px) {
  .pdf-fit {
    min-height: 44px;
  }
}
</style>
