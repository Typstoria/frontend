<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue';
import type { Diagnostic } from './compilation-api';
import type { createCompilationModel } from './compilation-model';

const PdfDocument = defineAsyncComponent(() => import('./PdfDocument.vue'));
const props = defineProps<{
  output: ReturnType<typeof createCompilationModel>['state'];
  headId: number;
  unsaved: boolean;
  canOpenFile: (item: Diagnostic) => boolean;
}>();
const emit = defineEmits<{ retry: []; download: []; source: [item: Diagnostic] }>();
const mode = ref<'pdf' | 'diagnostics'>('pdf');
const diagnostics = computed(() => props.output.job?.diagnostics ?? []);
const previousPdf = computed(() => {
  const artifact = props.output.artifact;
  return (
    !!artifact &&
    (artifact.job.id !== props.output.job?.id ||
      artifact.revision.id !== props.headId ||
      !artifact.job.isCurrent ||
      props.unsaved)
  );
});
const progress = computed(() => {
  if (props.output.startupStage === 'lookup') return 'Завантаження PDF…';
  if (props.output.startupStage === 'ensure') return 'Запуск компіляції…';
  if (props.output.job?.status === 'queued') return 'У черзі…';
  if (props.output.job?.status === 'running') return 'Компіляція…';
  if (props.output.job?.status === 'succeeded') return 'Завантаження PDF…';
  return 'Запуск компіляції…';
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
        v-if="output.artifact && mode === 'pdf'"
        class="button button-quiet output-download"
        @click="emit('download')"
      >
        Завантажити PDF
      </button>
    </header>
    <div
      v-if="output.busy || output.error"
      class="output-notice"
      :class="{ 'output-error': output.error }"
    >
      <p v-if="output.busy" role="status">{{ progress }}</p>
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
      <p v-if="previousPdf" class="output-revision">
        PDF версії {{ output.artifact.revision.number }}. Скомпілюйте ще раз для актуального
        документа.
      </p>
      <PdfDocument :key="output.artifact.job.id" :pdf="output.artifact.pdf" />
    </div>
    <p v-else-if="mode === 'pdf' && !output.busy && !output.error" class="output-empty">
      Скомпілюйте документ, щоб переглянути PDF.
    </p>
  </section>
</template>

<style scoped>
.workspace-output-pdf {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}
</style>
