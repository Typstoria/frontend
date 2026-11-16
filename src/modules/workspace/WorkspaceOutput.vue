<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import type { Diagnostic } from './compilation-api';
import type { createCompilationModel } from './compilation-model';

const PdfDocument = defineAsyncComponent(() => import('./PdfDocument.vue'));
const props = defineProps<{
  output: ReturnType<typeof createCompilationModel>['state'];
  headId: number;
  unsaved: boolean;
  canOpenFile: (item: Diagnostic) => boolean;
}>();
type Artifact = NonNullable<typeof props.output.artifact>;
const emit = defineEmits<{
  retry: [];
  download: [artifact: Artifact];
  open: [artifact: Artifact];
  source: [item: Diagnostic];
}>();
const mode = ref<'pdf' | 'diagnostics'>('pdf');
const displayedArtifact = shallowRef<Artifact | null>(null);
function setDisplayedPdf(pdf: Blob) {
  if (props.output.artifact?.pdf === pdf) displayedArtifact.value = props.output.artifact;
}
watch(
  () => props.output.artifact,
  (artifact) => {
    if (!artifact) displayedArtifact.value = null;
  },
);
const displayedPdfAvailable = ref(false);
watch(displayedArtifact, (artifact, _, onCleanup) => {
  const remaining = Date.parse(artifact?.job.artifactExpiresAt ?? '') - Date.now();
  displayedPdfAvailable.value = remaining > 0;
  if (remaining > 0) {
    const timer = setTimeout(() => {
      displayedPdfAvailable.value = false;
    }, remaining);
    onCleanup(() => clearTimeout(timer));
  }
});
const showInitialSkeleton = ref(false);
let skeletonTimer: ReturnType<typeof setTimeout> | undefined;
const diagnostics = computed(() => props.output.job?.diagnostics ?? []);
const previousPdf = computed(() => {
  const artifact = displayedArtifact.value;
  return (
    !!artifact &&
    (artifact.job.id !== props.output.job?.id ||
      artifact.revision.id !== props.headId ||
      !artifact.job.isCurrent ||
      props.unsaved)
  );
});
const progress = computed(() => {
  return props.output.artifact ? 'Оновлення PDF…' : 'Підготовка PDF…';
});

watch(
  () => [props.output.busy, !!props.output.artifact] as const,
  ([busy, hasArtifact]) => {
    if (skeletonTimer) clearTimeout(skeletonTimer);
    skeletonTimer = undefined;
    showInitialSkeleton.value = false;
    if (busy && !hasArtifact) {
      skeletonTimer = setTimeout(() => {
        showInitialSkeleton.value = true;
        skeletonTimer = undefined;
      }, 200);
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (skeletonTimer) clearTimeout(skeletonTimer);
});

watch(
  () => [props.output.job?.id, props.output.job?.status, !!props.output.artifact] as const,
  () => {
    if (!props.output.artifact && diagnostics.value.length) {
      mode.value = 'diagnostics';
      return;
    }
    mode.value =
      diagnostics.value.length && props.output.job?.status !== 'succeeded' ? 'diagnostics' : 'pdf';
  },
  { immediate: true },
);
</script>

<template>
  <section id="workspace-output" class="workspace-output" aria-label="Результат компіляції">
    <header class="output-heading">
      <div class="output-modes">
        <button
          v-if="output.artifact && diagnostics.length"
          class="button button-quiet"
          :aria-pressed="mode === 'pdf'"
          @click="mode = 'pdf'"
        >
          PDF
        </button>
        <button
          v-if="output.artifact && diagnostics.length"
          class="button button-quiet"
          :aria-pressed="mode === 'diagnostics'"
          @click="mode = 'diagnostics'"
        >
          Діагностика ({{ diagnostics.length }})
        </button>
        <h2 v-if="!output.artifact && diagnostics.length">
          Діагностика ({{ diagnostics.length }})
        </h2>
        <h2 v-else-if="!diagnostics.length">PDF</h2>
      </div>
      <button
        v-if="displayedArtifact && displayedPdfAvailable && mode === 'pdf'"
        class="button button-quiet output-download"
        type="button"
        title="Завантажити PDF"
        aria-label="Завантажити PDF"
        @click="emit('download', displayedArtifact)"
      >
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <path d="M10 2.5v9m0 0 3.5-3.5M10 11.5 6.5 8M3.5 13v3.5h13V13" />
        </svg>
      </button>
      <button
        v-if="displayedArtifact && displayedPdfAvailable && mode === 'pdf'"
        class="button button-quiet output-open"
        type="button"
        title="Відкрити PDF у новій вкладці"
        aria-label="Відкрити PDF у новій вкладці"
        @click="emit('open', displayedArtifact)"
      >
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <path d="M11.5 3.5h5v5m-.5-4.5-7 7" />
          <path d="M15 10.5v5a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
        </svg>
      </button>
      <span v-if="output.busy && output.artifact" class="output-spinner" aria-hidden="true" />
    </header>
    <div
      v-if="output.busy || output.error"
      class="output-notice"
      :class="{ 'output-error': output.error, 'output-refreshing': output.busy }"
    >
      <p v-if="output.busy" role="status" class="sr-only">
        {{ progress }}
      </p>
      <p v-else role="alert">{{ output.error }}</p>
      <button v-if="output.retry" class="button button-quiet" @click="emit('retry')">
        {{
          output.retry === 'status'
            ? 'Перевірити статус'
            : output.retry === 'startup'
              ? 'Повторити'
              : 'Повторити завантаження'
        }}
      </button>
    </div>
    <div v-if="mode === 'diagnostics' && diagnostics.length" class="output-diagnostics">
      <p v-if="output.revision" class="output-revision">Версія {{ output.revision.number }}</p>
      <ul>
        <li v-for="(item, index) in diagnostics" :key="index" :class="item.severity">
          <span class="diagnostic-severity">{{
            item.severity === 'error' ? 'Помилка' : 'Попередження'
          }}</span>
          <button
            v-if="canOpenFile(item)"
            type="button"
            class="diagnostic-link"
            @click="emit('source', item)"
          >
            {{ item.path }}
          </button>
          <span v-else-if="item.path" class="diagnostic-path">{{ item.path }}</span>
          <p>{{ item.message }}</p>
        </li>
      </ul>
    </div>
    <div v-if="output.artifact" v-show="mode === 'pdf'" class="workspace-output-pdf">
      <p v-if="previousPdf && displayedArtifact" class="output-revision">
        PDF версії {{ displayedArtifact.revision.number }}.
      </p>
      <PdfDocument :pdf="output.artifact.pdf" @displayed="setDisplayedPdf" />
    </div>
    <div
      v-else-if="mode === 'pdf' && output.busy && showInitialSkeleton"
      class="output-pdf-skeleton"
      aria-hidden="true"
    >
      <div class="output-paper-skeleton"></div>
    </div>
    <p v-else-if="mode === 'pdf' && !output.busy && !output.error" class="output-empty">
      Скомпілюйте документ, щоб переглянути PDF.
    </p>
  </section>
</template>

<style scoped>
.output-download {
  margin-left: auto;
}

.output-heading .output-download,
.output-heading .output-open {
  display: inline-grid;
  width: 34px;
  min-width: 34px;
  place-items: center;
  padding: 4px;
}

.output-heading svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.6;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.output-notice.output-refreshing {
  min-height: 0;
  padding-block: 0;
  border-bottom: 0;
}

.output-spinner {
  width: 16px;
  height: 16px;
  margin-left: 2px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-muted);
  border-radius: 50%;
  animation: output-spin 800ms linear infinite;
}

.output-pdf-skeleton {
  display: grid;
  flex: 1;
  min-height: 180px;
  place-items: center;
  overflow: hidden;
  background: var(--color-surface);
}

.output-paper-skeleton {
  position: relative;
  width: min(70%, 420px, calc((100dvh - 220px) * 0.707));
  aspect-ratio: 210 / 297;
  overflow: hidden;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
}
.output-paper-skeleton::after {
  position: absolute;
  inset: 0;
  content: '';
  background: linear-gradient(100deg, transparent 20%, #edf3f8 50%, transparent 80%);
  transform: translateX(-100%);
  animation: output-paper-shimmer 1.5s linear infinite;
}

@keyframes output-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes output-paper-shimmer {
  to {
    transform: translateX(100%);
  }
}
@media (prefers-reduced-motion: reduce) {
  .output-spinner,
  .output-paper-skeleton::after {
    animation: none;
  }
  .output-paper-skeleton::after {
    transform: none;
  }
}

@media (max-width: 720px) {
  .output-heading .output-download,
  .output-heading .output-open {
    width: 44px;
    min-width: 44px;
  }
}

.workspace-output-pdf {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}
</style>
