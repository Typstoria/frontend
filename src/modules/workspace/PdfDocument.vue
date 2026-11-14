<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { PDFDocumentProxy, PDFDocumentLoadingTask, RenderTask, TextLayer } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

const props = defineProps<{ pdf: Blob }>();

const pageFrame = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const textHost = ref<HTMLElement | null>(null);
const pageNumber = ref(1);
const pageCount = ref(0);
const loading = ref(true);
const error = ref('');
const renderError = ref(false);

let loadingTask: PDFDocumentLoadingTask | undefined;
let documentProxy: PDFDocumentProxy | undefined;
let renderTask: RenderTask | undefined;
let textLayer: TextLayer | undefined;
let textRenderPromise: Promise<unknown> | undefined;
let observer: ResizeObserver | undefined;
let generation = 0;
let renderSequence = 0;
let renderFrame = 0;
let destroyed = false;

async function releaseDocument(expectedGeneration: number) {
  const previousRender = renderTask;
  previousRender?.cancel();
  const previousTextLayer = textLayer;
  const previousTextRender = textRenderPromise;
  previousTextLayer?.cancel();
  const task = loadingTask;
  loadingTask = undefined;
  documentProxy = undefined;
  await Promise.allSettled([
    ...(previousRender ? [previousRender.promise] : []),
    ...(previousTextRender ? [previousTextRender] : []),
  ]);
  if (task) {
    try {
      await task.destroy();
    } catch {
      // A cancelled or invalid document can already have released its worker.
    }
  }
  if (destroyed || generation !== expectedGeneration) return;
  if (renderTask === previousRender) renderTask = undefined;
  if (textLayer === previousTextLayer) textLayer = undefined;
  if (textRenderPromise === previousTextRender) textRenderPromise = undefined;
  if (canvas.value) {
    canvas.value.width = 0;
    canvas.value.height = 0;
  }
  if (textHost.value) textHost.value.replaceChildren();
}

async function renderPage(expectedGeneration: number) {
  const sequence = ++renderSequence;
  const requestedPage = pageNumber.value;
  const pdf = documentProxy;
  const canvasElement = canvas.value;
  const textElement = textHost.value;
  const frame = pageFrame.value;
  if (!pdf || !canvasElement || !textElement || !frame || frame.clientWidth < 1) return;

  const previousRender = renderTask;
  previousRender?.cancel();
  const previousTextLayer = textLayer;
  const previousTextRender = textRenderPromise;
  previousTextLayer?.cancel();
  await Promise.allSettled([
    ...(previousRender ? [previousRender.promise] : []),
    ...(previousTextRender ? [previousTextRender] : []),
  ]);
  if (
    destroyed ||
    generation !== expectedGeneration ||
    sequence !== renderSequence ||
    pdf !== documentProxy
  )
    return;
  if (renderTask === previousRender) renderTask = undefined;
  if (textLayer === previousTextLayer) textLayer = undefined;
  if (textRenderPromise === previousTextRender) textRenderPromise = undefined;

  textElement.replaceChildren();
  renderError.value = false;

  try {
    const page = await pdf.getPage(requestedPage);
    if (
      destroyed ||
      generation !== expectedGeneration ||
      sequence !== renderSequence ||
      pdf !== documentProxy
    )
      return;

    const unscaledViewport = page.getViewport({ scale: 1 });
    if (
      !Number.isFinite(unscaledViewport.width) ||
      !Number.isFinite(unscaledViewport.height) ||
      unscaledViewport.width <= 0 ||
      unscaledViewport.height <= 0 ||
      !Number.isFinite(unscaledViewport.width * unscaledViewport.height)
    )
      throw new Error('Invalid page dimensions');
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const maxPixels = 16_000_000;
    const maxCanvasSide = 8192;
    const frameStyles = getComputedStyle(frame);
    const horizontalPadding =
      Number.parseFloat(frameStyles.paddingLeft) + Number.parseFloat(frameStyles.paddingRight);
    const availableWidth = frame.clientWidth - horizontalPadding;
    if (availableWidth <= 0) return;
    const fitScale = availableWidth / unscaledViewport.width;
    const boundedScale = Math.min(
      fitScale,
      2,
      maxCanvasSide / (unscaledViewport.width * pixelRatio),
      maxCanvasSide / (unscaledViewport.height * pixelRatio),
      Math.sqrt(maxPixels / (unscaledViewport.width * unscaledViewport.height * pixelRatio ** 2)),
    );
    if (!Number.isFinite(boundedScale) || boundedScale <= 0) throw new Error('Invalid page scale');
    const cssScale = boundedScale;
    const viewport = page.getViewport({ scale: cssScale });
    const outputViewport = page.getViewport({ scale: cssScale * pixelRatio });
    canvasElement.width = Math.ceil(outputViewport.width);
    canvasElement.height = Math.ceil(outputViewport.height);
    canvasElement.style.width = `${Math.ceil(viewport.width)}px`;
    canvasElement.style.height = `${Math.ceil(viewport.height)}px`;
    textElement.style.width = `${Math.ceil(viewport.width)}px`;
    textElement.style.height = `${Math.ceil(viewport.height)}px`;
    textElement.style.setProperty('--total-scale-factor', String(cssScale));

    const context = canvasElement.getContext('2d', { alpha: false });
    if (!context) throw new Error('Canvas is unavailable');
    const task = page.render({
      canvas: canvasElement,
      canvasContext: context,
      viewport: outputViewport,
    });
    renderTask = task;
    await task.promise;
    if (
      destroyed ||
      generation !== expectedGeneration ||
      sequence !== renderSequence ||
      pdf !== documentProxy
    )
      return;

    const layer = await page.getTextContent();
    if (
      destroyed ||
      generation !== expectedGeneration ||
      sequence !== renderSequence ||
      pdf !== documentProxy
    )
      return;
    const pdfjs = await import('pdfjs-dist');
    if (
      destroyed ||
      generation !== expectedGeneration ||
      sequence !== renderSequence ||
      pdf !== documentProxy
    )
      return;
    const textRendering = new pdfjs.TextLayer({
      textContentSource: layer,
      container: textElement,
      viewport,
    });
    textLayer = textRendering;
    const textPromise = textRendering.render();
    textRenderPromise = textPromise;
    await textPromise;
    if (
      destroyed ||
      generation !== expectedGeneration ||
      sequence !== renderSequence ||
      pdf !== documentProxy
    )
      return;
  } catch {
    if (!destroyed && generation === expectedGeneration && sequence === renderSequence)
      renderError.value = true;
  } finally {
    if (generation === expectedGeneration && sequence === renderSequence) {
      renderTask = undefined;
      textRenderPromise = undefined;
    }
  }
}

async function openPdf(blob: Blob) {
  const currentGeneration = ++generation;
  loading.value = true;
  error.value = '';
  pageCount.value = 0;
  pageNumber.value = 1;
  renderSequence++;
  await releaseDocument(currentGeneration);
  if (destroyed || generation !== currentGeneration) return;

  try {
    const pdfjs = await import('pdfjs-dist');
    if (destroyed || generation !== currentGeneration) return;
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    const data = await blob.arrayBuffer();
    if (destroyed || generation !== currentGeneration) return;
    const task = pdfjs.getDocument({ data });
    loadingTask = task;
    const document = await task.promise;
    if (destroyed || generation !== currentGeneration) {
      await task.destroy();
      return;
    }
    documentProxy = document;
    pageCount.value = document.numPages;
    loading.value = false;
    await nextTick();
    if (destroyed || generation !== currentGeneration) return;
    await renderPage(currentGeneration);
  } catch {
    if (!destroyed && generation === currentGeneration) {
      loading.value = false;
      error.value = 'Не вдалося відобразити PDF. Спробуйте завантажити його ще раз.';
    }
  }
}

function changePage(delta: number) {
  const nextPage = pageNumber.value + delta;
  if (nextPage < 1 || nextPage > pageCount.value) return;
  pageNumber.value = nextPage;
  if (pageFrame.value) pageFrame.value.scrollTop = 0;
  void renderPage(generation);
}

function retry() {
  void openPdf(props.pdf);
}

watch(
  () => props.pdf,
  (pdf) => void openPdf(pdf),
  { immediate: true },
);

onMounted(() => {
  observer = new ResizeObserver(() => {
    cancelAnimationFrame(renderFrame);
    renderFrame = requestAnimationFrame(() => void renderPage(generation));
  });
  if (pageFrame.value) observer.observe(pageFrame.value);
});

onBeforeUnmount(() => {
  destroyed = true;
  generation++;
  renderSequence++;
  observer?.disconnect();
  cancelAnimationFrame(renderFrame);
  void releaseDocument(generation);
});
</script>

<template>
  <section class="pdf-document" aria-label="Перегляд PDF">
    <div ref="pageFrame" class="pdf-page-frame" :aria-busy="loading">
      <p v-if="loading" class="pdf-message" role="status">Відкриваємо PDF…</p>
      <div v-else-if="error" class="pdf-message" role="alert">
        <p>{{ error }}</p>
        <button class="button button-secondary" @click="retry">Спробувати ще раз</button>
      </div>
      <div v-else-if="renderError" class="pdf-message" role="alert">
        <p>Не вдалося відобразити сторінку.</p>
        <button class="button button-secondary" @click="retry">Спробувати ще раз</button>
      </div>
      <div v-show="!loading && !error && !renderError" class="pdf-page">
        <canvas ref="canvas" aria-label="Сторінка PDF" />
        <div ref="textHost" class="pdf-text-layer" aria-label="Текст сторінки" />
      </div>
    </div>
    <nav v-if="pageCount > 1" class="pdf-pagination" aria-label="Сторінки PDF">
      <button
        class="button button-secondary"
        :disabled="loading || pageNumber <= 1"
        aria-label="Попередня сторінка"
        @click="changePage(-1)"
      >
        Попередня
      </button>
      <span aria-live="polite">{{ pageNumber }} / {{ pageCount }}</span>
      <button
        class="button button-secondary"
        :disabled="loading || pageNumber >= pageCount"
        aria-label="Наступна сторінка"
        @click="changePage(1)"
      >
        Наступна
      </button>
    </nav>
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
  display: flex;
  flex: 1;
  align-items: flex-start;
  justify-content: center;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: 16px;
}

.pdf-page {
  position: relative;
  flex: none;
  background: #fff;
  box-shadow: 0 1px 5px rgb(20 32 40 / 18%);
}

.pdf-page canvas {
  display: block;
  max-width: none;
}

.pdf-text-layer {
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

.pdf-text-layer :deep(span),
.pdf-text-layer :deep(br) {
  position: absolute;
  color: transparent;
  white-space: pre;
  cursor: text;
  transform-origin: 0 0;
  user-select: text;
}

.pdf-text-layer :deep(> :not(.markedContent)),
.pdf-text-layer :deep(.markedContent span:not(.markedContent)) {
  z-index: 1;
  font-size: calc(var(--total-scale-factor) * var(--font-height));
  transform: rotate(var(--rotate, 0deg)) scaleX(var(--scale-x, 1));
}

.pdf-text-layer :deep(.markedContent) {
  display: contents;
}

.pdf-text-layer ::selection {
  background: rgb(0 100 220 / 24%);
  color: transparent;
}

.pdf-message {
  align-self: center;
  margin: auto;
  padding: 20px;
  text-align: center;
  color: var(--color-muted, #5d6870);
}

.pdf-message p {
  margin: 0 0 12px;
}

.pdf-pagination {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  gap: 16px;
  min-height: 56px;
  padding: 8px 12px;
  border-top: 1px solid var(--color-border, #d8dee3);
  background: var(--color-surface, #fff);
  color: var(--color-text, #202a31);
  font-size: 13px;
}

.pdf-pagination .button {
  min-height: 40px;
}

@media (max-width: 480px) {
  .pdf-page-frame {
    padding: 8px;
  }

  .pdf-pagination {
    gap: 10px;
  }

  .pdf-pagination .button {
    padding-inline: 10px;
  }
}
</style>
