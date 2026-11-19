<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  createTypstRenderer,
  type RenderSession,
  type TypstRenderer,
} from '@myriaddreamin/typst.ts';
import rendererWasm from '@myriaddreamin/typst-ts-renderer/wasm?url';
import {
  MAX_PDF_SCALE,
  MIN_PDF_SCALE,
  pageAt,
  pdfAnchor,
  pdfLayout,
  scrollForAnchor,
  type PageSize,
  type PdfAnchor,
  type PdfLayout,
  type PdfView,
} from './pdf-layout';

const props = defineProps<{ document: Uint8Array; initialView?: PdfView | undefined }>();
const emit = defineEmits<{
  displayed: [document: Uint8Array];
  failed: [document: Uint8Array];
  viewChange: [view: PdfView];
}>();

type PageSlot = { node: HTMLDivElement; scale?: number; canvas?: HTMLCanvasElement };
type Point = { x: number; y: number };
type PreparedPage = { index: number; canvas: HTMLCanvasElement };
type LoadedVector = { bytes: Uint8Array; sizes: PageSize[] };
type PendingVector = { document: LoadedVector; generation: number };

const frame = ref<HTMLElement | null>(null);
const stack = ref<HTMLElement | null>(null);
const loading = ref(true);
const error = ref(false);
const pageCount = ref(0);
const pageNumber = ref(1);
const zoom = ref<number | null>(props.initialView?.zoom ?? null);
const scale = ref(1);
const maxScale = ref(MAX_PDF_SCALE);
const zoomPercent = computed(() => Math.round(scale.value * 100));
const slots = new Map<number, PageSlot>();
let renderer: TypstRenderer | undefined;
let rendererPromise: Promise<TypstRenderer> | undefined;
let current: LoadedVector | undefined;
let pendingViewport: PendingVector | undefined;
let layout: PdfLayout | undefined;
let anchor: PdfAnchor | null = props.initialView?.anchor ? { ...props.initialView.anchor } : null;
let resizeObserver: ResizeObserver | undefined;
let frameRequest = 0;
let documentGeneration = 0;
let pageRenderGeneration = 0;
let installingGeneration = 0;
let viewportWidth = 0;
let viewportHeight = 0;
let renderedZoom: number | null = null;
let disposed = false;
let pinch: { distance: number; scale: number; anchor: PdfAnchor } | undefined;

function viewSize(): PageSize | null {
  const element = frame.value;
  return element?.clientWidth && element.clientHeight
    ? { width: element.clientWidth, height: element.clientHeight }
    : null;
}

function makeLayout(doc: LoadedVector, size: PageSize) {
  return pdfLayout(doc.sizes, size, size.width <= 480 ? 8 : 16, zoom.value);
}

function readAnchor(point: Point): PdfAnchor | null {
  const element = frame.value;
  if (!layout || !element || !viewSize()) return anchor;
  return pdfAnchor(layout, { x: element.scrollLeft + point.x, y: element.scrollTop + point.y });
}

function publishView() {
  emit('viewChange', { zoom: zoom.value, anchor: anchor ? { ...anchor } : null });
}

function updatePageIndicator() {
  const element = frame.value;
  if (!element || !layout) return;
  const maxScroll = element.scrollHeight - element.clientHeight;
  pageNumber.value =
    maxScroll > 0 && element.scrollTop >= maxScroll - 1
      ? layout.pages.length
      : pageAt(layout, element.scrollTop) + 1;
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
  updatePageIndicator();
}

function clearCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
}

function removeSlot(slot: PageSlot) {
  if (slot.canvas) clearCanvas(slot.canvas);
  slot.node.remove();
}

function clearSlots() {
  for (const slot of slots.values()) removeSlot(slot);
  slots.clear();
}

function attachCanvas(slot: PageSlot, canvas: HTMLCanvasElement, pageScale: number) {
  if (slot.canvas && slot.canvas !== canvas) clearCanvas(slot.canvas);
  slot.node.replaceChildren(canvas);
  slot.canvas = canvas;
  slot.scale = pageScale;
}

function createCanvas(page: PageSize, pageScale: number, pixelBudget: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.width = `${page.width * pageScale}px`;
  canvas.style.height = `${page.height * pageScale}px`;
  const ratio = Math.min(
    window.devicePixelRatio || 1,
    4,
    4096 / (page.width * pageScale),
    4096 / (page.height * pageScale),
    Math.sqrt(pixelBudget / (page.width * pageScale) / (page.height * pageScale)),
  );
  canvas.width = Math.max(1, Math.ceil(page.width * pageScale * ratio));
  canvas.height = Math.max(1, Math.ceil(page.height * pageScale * ratio));
  return canvas;
}

function pageRange(docLayout: PdfLayout, position: Point, size: PageSize) {
  const firstVisible = pageAt(docLayout, position.y);
  const lastVisible = pageAt(docLayout, position.y + size.height);
  return {
    firstVisible,
    lastVisible,
    first: Math.max(0, firstVisible - 1),
    last: Math.min(docLayout.pages.length - 1, lastVisible + 1),
  };
}

function ensureSlots(docLayout: PdfLayout, first: number, last: number) {
  const surface = stack.value!;
  for (const [index, slot] of slots) {
    if (index < first || index > last) {
      removeSlot(slot);
      slots.delete(index);
    }
  }
  for (let index = first; index <= last; index++) {
    const page = docLayout.pages[index]!;
    let slot = slots.get(index);
    if (!slot) {
      const node = document.createElement('div');
      node.className = 'vector-page';
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
    if (slot.canvas && slot.scale !== docLayout.scale)
      slot.canvas.style.transform = `scale(${docLayout.scale / slot.scale!})`;
  }
}

async function renderPages(
  doc: LoadedVector,
  docLayout: PdfLayout,
  indexes: number[],
): Promise<PreparedPage[]> {
  const activeRenderer = renderer;
  if (!activeRenderer || !indexes.length) return [];
  const pixelBudget = Math.min(2_500_000, 10_000_000 / indexes.length);
  return activeRenderer.runWithSession(
    { format: 'vector', artifactContent: doc.bytes },
    async (session: RenderSession) => {
      const prepared: PreparedPage[] = [];
      try {
        for (const index of indexes) {
          const page = docLayout.pages[index]!;
          const canvas = createCanvas(doc.sizes[index]!, docLayout.scale, pixelBudget);
          const ctx = canvas.getContext('2d', { alpha: false });
          if (!ctx) throw new Error('Canvas is unavailable');
          try {
            await activeRenderer.renderCanvas({
              renderSession: session,
              canvas: ctx,
              pageOffset: index,
              pixelPerPt: docLayout.scale * (canvas.width / (page.width * docLayout.scale)),
              backgroundColor: '#ffffff',
              dataSelection: { body: true },
            });
            prepared.push({ index, canvas });
          } catch (cause) {
            clearCanvas(canvas);
            throw cause;
          }
        }
        return prepared;
      } catch (cause) {
        prepared.forEach(({ canvas }) => clearCanvas(canvas));
        throw cause;
      }
    },
  );
}

function getRenderer(): Promise<TypstRenderer> {
  if (!rendererPromise) {
    const instance = createTypstRenderer();
    renderer = instance;
    rendererPromise = instance
      .init({ getModule: () => rendererWasm })
      .then(() => instance)
      .catch((cause: unknown) => {
        renderer = undefined;
        rendererPromise = undefined;
        throw cause;
      });
  }
  return rendererPromise;
}

async function installDocument(request: PendingVector, size: PageSize) {
  const { document: doc, generation } = request;
  const next = makeLayout(doc, size);
  const position = scrollForAnchor(next, anchor, { x: size.width / 2, y: 0 }, size);
  const range = pageRange(next, position, size);
  const indexes = Array.from(
    { length: range.last - range.first + 1 },
    (_, offset) => range.first + offset,
  );
  const prepared = await renderPages(doc, next, indexes);
  if (disposed || generation !== documentGeneration) {
    prepared.forEach(({ canvas }) => clearCanvas(canvas));
    return;
  }
  clearSlots();
  pageRenderGeneration++;
  pendingViewport = undefined;
  current = doc;
  pageCount.value = doc.sizes.length;
  if (anchor && anchor.page >= doc.sizes.length) anchor = { ...anchor, page: doc.sizes.length - 1 };
  applyLayout(next, size, position);
  ensureSlots(next, range.first, range.last);
  prepared.forEach(({ index, canvas }) => {
    const slot = slots.get(index);
    if (slot) attachCanvas(slot, canvas, next.scale);
    else clearCanvas(canvas);
  });
  if (!anchor) anchor = readAnchor({ x: size.width / 2, y: 0 });
  loading.value = false;
  error.value = false;
  emit('displayed', doc.bytes);
  scheduleFrame();
}

function failPendingDocument(request: PendingVector) {
  if (pendingViewport !== request || request.generation !== documentGeneration) return;
  pendingViewport = undefined;
  loading.value = false;
  error.value = true;
  emit('failed', request.document.bytes);
}

function scheduleFrame() {
  if (disposed || frameRequest) return;
  frameRequest = requestAnimationFrame(() => {
    frameRequest = 0;
    const size = viewSize();
    if (!size) return;
    const deferred = pendingViewport;
    if (deferred && installingGeneration !== deferred.generation) {
      installingGeneration = deferred.generation;
      void installDocument(deferred, size)
        .catch(() => failPendingDocument(deferred))
        .finally(() => {
          if (installingGeneration === deferred.generation) installingGeneration = 0;
        });
      return;
    }
    if (!current || !layout) return;
    if (
      size.width !== viewportWidth ||
      size.height !== viewportHeight ||
      zoom.value !== renderedZoom
    ) {
      const next = makeLayout(current, size);
      const position = scrollForAnchor(next, anchor, { x: size.width / 2, y: 0 }, size);
      applyLayout(next, size, position);
    }
    void syncPages();
  });
}

async function syncPages() {
  const element = frame.value;
  const doc = current;
  const docLayout = layout;
  const size = viewSize();
  if (!element || !doc || !docLayout || !size) return;
  const range = pageRange(docLayout, { x: element.scrollLeft, y: element.scrollTop }, size);
  ensureSlots(docLayout, range.first, range.last);
  const missing = Array.from(
    { length: range.last - range.first + 1 },
    (_, offset) => range.first + offset,
  ).filter((index) => {
    const slot = slots.get(index);
    return !slot?.canvas || slot.scale !== docLayout.scale;
  });
  if (!missing.length) return;
  const generation = ++pageRenderGeneration;
  try {
    const prepared = await renderPages(doc, docLayout, missing);
    if (
      disposed ||
      current !== doc ||
      layout !== docLayout ||
      generation !== pageRenderGeneration
    ) {
      prepared.forEach(({ canvas }) => clearCanvas(canvas));
      return;
    }
    for (const { index, canvas } of prepared) {
      const slot = slots.get(index);
      if (slot) attachCanvas(slot, canvas, docLayout.scale);
      else clearCanvas(canvas);
    }
  } catch {
    if (current === doc && layout === docLayout && generation === pageRenderGeneration) {
      error.value = true;
      emit('failed', doc.bytes);
    }
  }
}

function onScroll() {
  const element = frame.value;
  if (!element || !layout) return;
  anchor = readAnchor({ x: element.clientWidth / 2, y: 0 });
  updatePageIndicator();
  if (current) publishView();
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
  applyLayout(next, size, scrollForAnchor(next, keep, origin, size));
  if (point) anchor = readAnchor(origin);
  publishView();
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
  return {
    distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
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

async function openDocument(bytes: Uint8Array) {
  const generation = ++documentGeneration;
  pageRenderGeneration++;
  pendingViewport = undefined;
  installingGeneration = 0;
  loading.value = true;
  error.value = false;
  try {
    const activeRenderer = await getRenderer();
    if (disposed || generation !== documentGeneration) return;
    const sizes = await activeRenderer.runWithSession(
      { format: 'vector', artifactContent: bytes },
      async (session) =>
        session.retrievePagesInfo().map(({ width, height }) => ({ width, height })),
    );
    if (disposed || generation !== documentGeneration) return;
    if (
      !sizes.length ||
      sizes.length > 5000 ||
      sizes.some(
        ({ width, height }) =>
          !Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0,
      )
    )
      throw new Error('Unsupported page dimensions');
    const doc: LoadedVector = { bytes, sizes };
    const size = viewSize();
    if (!size) {
      pendingViewport = { document: doc, generation };
      return;
    }
    await installDocument({ document: doc, generation }, size);
  } catch {
    if (disposed || generation !== documentGeneration) return;
    loading.value = false;
    error.value = true;
    emit('failed', bytes);
  }
}

onMounted(() => {
  resizeObserver = new ResizeObserver(scheduleFrame);
  if (frame.value) resizeObserver.observe(frame.value);
  void openDocument(props.document);
});

watch(
  () => props.document,
  (bytes) => void openDocument(bytes),
);

onBeforeUnmount(() => {
  disposed = true;
  documentGeneration++;
  pageRenderGeneration++;
  resizeObserver?.disconnect();
  pendingViewport = undefined;
  cancelAnimationFrame(frameRequest);
  clearSlots();
});
</script>

<template>
  <section class="live-preview-document" aria-label="Попередній перегляд документа">
    <div v-if="error" class="preview-message preview-message-error" role="alert">
      <p>Не вдалося відобразити документ.</p>
    </div>
    <div
      ref="frame"
      class="preview-page-frame"
      tabindex="0"
      aria-label="Сторінки документа"
      :aria-busy="loading"
      @scroll.passive="onScroll"
      @wheel="onWheel"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="endPinch"
      @touchcancel="endPinch"
    >
      <div ref="stack" class="preview-page-stack"></div>
      <p v-if="!pageCount && loading" class="preview-message" role="status">
        Відкриваємо документ…
      </p>
    </div>
    <div v-if="pageCount" class="preview-controls" role="group" aria-label="Масштаб документа">
      <span class="preview-page-indicator" role="status" aria-label="Поточна сторінка"
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
      <span class="preview-zoom-value" role="status">{{ zoomPercent }}%</span>
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
        class="button button-quiet preview-fit"
        :aria-pressed="zoom === null"
        @click="setZoom(null)"
      >
        За шириною
      </button>
    </div>
  </section>
</template>

<style scoped>
.live-preview-document {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: #edf0f2;
}
.preview-page-frame {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  overflow-anchor: none;
  scrollbar-gutter: stable;
  touch-action: pan-x pan-y;
}
.preview-page-frame:focus-visible {
  outline-offset: -2px;
}
.preview-page-stack {
  position: relative;
}
:deep(.vector-page) {
  position: absolute;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 1px 5px rgb(20 32 40 / 18%);
}
:deep(.vector-page canvas) {
  display: block;
  max-width: none;
  transform-origin: 0 0;
}
.preview-message {
  padding: 12px;
  margin: 0;
  text-align: center;
  color: var(--color-muted);
}
.preview-message-error {
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}
.preview-controls {
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
.preview-controls .file-icon-button svg {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
}
.preview-page-indicator,
.preview-zoom-value {
  min-width: 44px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.preview-fit {
  min-height: 34px;
  padding: 4px 8px;
  font-size: inherit;
}
.preview-fit[aria-pressed='true'] {
  color: var(--color-primary);
  background: #e8f2f6;
}
@media (max-width: 720px) {
  .preview-fit {
    min-height: 44px;
  }
}
</style>
