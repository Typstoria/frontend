<script setup lang="ts">
import { computed } from 'vue';
import MaterialChanges from '../workspace/MaterialChanges.vue';
import type { Material } from '../workspace/material-metadata';
import type {
  ProposalDiff,
  ProposalCandidate,
  ProposalTextFile,
  ReviewAnnotation,
} from './review-api';

const props = withDefaults(
  defineProps<{
    diff: ProposalDiff;
    candidate: ProposalCandidate;
    selectedFileId?: number | null;
    fileText: ProposalTextFile | null;
    fileLoading: boolean;
    fileError: string;
    annotations: Map<number, ReviewAnnotation>;
    annotationsLoading: boolean;
    annotationsError: string;
    accepted: boolean;
    downloading: boolean;
  }>(),
  { selectedFileId: null },
);

const emit = defineEmits<{
  select: [fileId: number];
  download: [fileId: number];
  downloadMaterial: [material: Material, side: 'before' | 'after'];
  retryAnnotations: [];
}>();

const candidateFiles = computed(() =>
  [...props.candidate.tree].sort((left, right) => left.path.localeCompare(right.path)),
);
const selectedFile = computed(
  () => candidateFiles.value.find((file) => file.fileId === props.selectedFileId) ?? null,
);
const fileChanges = computed(() =>
  [...props.diff.files].sort((left, right) => {
    const leftPath = left.after?.path ?? left.before?.path ?? '';
    const rightPath = right.after?.path ?? right.before?.path ?? '';
    return leftPath.localeCompare(rightPath);
  }),
);
const annotationChanges = computed(() =>
  props.diff.annotationOperations.map((operation) => {
    const annotation =
      operation.type === 'resolveAnnotation' ? props.annotations.get(operation.annotationId) : null;
    const matches =
      operation.type === 'resolveAnnotation' &&
      annotation &&
      (annotation.version === operation.expectedAnnotationVersion ||
        (props.accepted &&
          annotation.status === 'resolved' &&
          annotation.version === operation.expectedAnnotationVersion + 1));
    const source = operation.type === 'createAnnotation' ? operation : matches ? annotation : null;
    const fileId = source?.anchor.fileId;
    const path =
      fileId === undefined
        ? undefined
        : (fileChanges.value.find((file) => file.fileId === fileId)?.before?.path ??
          candidateFiles.value.find((file) => file.fileId === fileId)?.path);
    return {
      title: operation.type === 'createAnnotation' ? 'Додати коментар' : 'Позначити вирішеним',
      path,
      source,
    };
  }),
);

function changeLabel(change: string): string {
  const labels: Record<string, string> = {
    added: 'Додано',
    deleted: 'Видалено',
    modified: 'Змінено',
    renamed: 'Перейменовано',
  };
  return labels[change] ?? change;
}

function omittedLabel(reason: string | null): string {
  switch (reason) {
    case 'BINARY':
      return 'Текстове порівняння недоступне для бінарного файла.';
    case 'TEXT_TOO_LARGE':
      return 'Файл завеликий для текстового порівняння.';
    case 'PATCH_LIMIT':
    case 'COMPUTATION_LIMIT':
      return 'Текстове порівняння перевищує доступний обсяг.';
    default:
      return 'Текстове порівняння недоступне.';
  }
}

function lineKind(line: string): string {
  if (line.startsWith('+') && !line.startsWith('+++')) return 'review-line-added';
  if (line.startsWith('-') && !line.startsWith('---')) return 'review-line-deleted';
  return '';
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} Б`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} КБ`;
  return `${(size / (1024 * 1024)).toFixed(1)} МБ`;
}
</script>

<template>
  <section class="review-changes" aria-label="Зміни пропозиції">
    <section class="review-panel review-diff-panel" aria-labelledby="review-diff-heading">
      <header class="review-panel-heading">
        <h2 id="review-diff-heading">Зміни пропозиції</h2>
      </header>
      <p
        v-if="
          !fileChanges.length &&
          !diff.context.changed &&
          !diff.entrypoint.changed &&
          !diff.materials.length &&
          !diff.annotationOperations.length &&
          !diff.directories.added.length &&
          !diff.directories.deleted.length
        "
        class="review-empty"
      >
        У пропозиції немає змін.
      </p>
      <div v-for="file in fileChanges" :key="file.fileId" class="review-diff-file">
        <div class="review-diff-file-heading">
          <h3>{{ file.after?.path ?? file.before?.path ?? 'Файл' }}</h3>
          <div class="review-change-labels">
            <span v-for="change in file.changes" :key="change">{{ changeLabel(change) }}</span>
          </div>
        </div>
        <p
          v-if="file.before && file.after && file.before.path !== file.after.path"
          class="review-file-meta"
        >
          {{ file.before.path }} → {{ file.after.path }}
        </p>
        <template v-if="file.patch">
          <pre
            class="review-patch"
          ><code><span v-for="(line, index) in file.patch.split('\n')" :key="index" :class="lineKind(line)">{{ line }}
</span></code></pre>
        </template>
        <p v-else-if="file.patchOmittedReason" class="review-omitted">
          {{ omittedLabel(file.patchOmittedReason) }}
        </p>
        <p
          v-if="file.before?.contentKind === 'binary' || file.after?.contentKind === 'binary'"
          class="review-file-meta"
        >
          Розмір: {{ file.before ? formatBytes(file.before.sizeBytes) : '—' }} →
          {{ file.after ? formatBytes(file.after.sizeBytes) : '—' }}
        </p>
      </div>
      <MaterialChanges
        class="review-special-change"
        :changes="diff.materials"
        :downloading="downloading"
        downloads
        @download="(material, side) => emit('downloadMaterial', material, side)"
      />
      <section v-if="annotationChanges.length" class="review-special-change">
        <h3>Анотації</h3>
        <p v-if="annotationsLoading" role="status">Завантаження коментарів…</p>
        <p v-else-if="annotationsError" role="alert">
          {{ annotationsError }}
          <button type="button" class="button button-quiet" @click="emit('retryAnnotations')">
            Повторити
          </button>
        </p>
        <ul class="review-annotation-changes">
          <li v-for="({ title, path, source }, index) in annotationChanges" :key="index">
            <strong>{{ title }}</strong
            ><span v-if="path"> · {{ path }}</span>
            <template v-if="source">
              <blockquote>{{ source.anchor.quote }}</blockquote>
              <p>{{ source.body }}</p>
            </template>
            <p v-else-if="!annotationsLoading && !annotationsError">Коментар недоступний.</p>
          </li>
        </ul>
      </section>
      <section
        v-if="diff.directories.added.length || diff.directories.deleted.length"
        class="review-special-change"
      >
        <h3>Папки</h3>
        <ul>
          <li v-for="path in diff.directories.added" :key="`added-${path}`">Додано · {{ path }}</li>
          <li v-for="path in diff.directories.deleted" :key="`deleted-${path}`">
            Видалено · {{ path }}
          </li>
        </ul>
      </section>
      <section v-if="diff.context.changed" class="review-special-change">
        <h3>Контекст проєкту</h3>
        <pre
          v-if="diff.context.patch"
          class="review-patch"
        ><code><span v-for="(line, index) in diff.context.patch.split('\n')" :key="index" :class="lineKind(line)">{{ line }}
</span></code></pre>
        <template v-else>
          <p class="review-omitted">{{ omittedLabel(diff.context.patchOmittedReason) }}</p>
          <details>
            <summary>Запропонований контекст</summary>
            <pre
              v-if="candidate.contextText"
              class="review-source"
            ><code>{{ candidate.contextText }}</code></pre>
            <p v-else class="review-empty">Контекст очищено.</p>
          </details>
        </template>
      </section>
      <section v-if="diff.entrypoint.changed" class="review-special-change">
        <h3>Головний файл</h3>
        <p>
          {{
            fileChanges.find((file) => file.fileId === diff.entrypoint.beforeFileId)?.before
              ?.path ??
            candidate.tree.find((file) => file.fileId === diff.entrypoint.beforeFileId)?.path ??
            'Файл недоступний'
          }}
          →
          {{
            candidate.tree.find((file) => file.fileId === diff.entrypoint.afterFileId)?.path ??
            'Файл недоступний'
          }}
        </p>
      </section>
    </section>
    <details class="review-panel review-file-browser">
      <summary>Файли пропозиції</summary>
      <div class="review-browser">
        <section class="review-panel review-file-panel" aria-label="Список файлів">
          <p v-if="candidateFiles.length === 0" class="review-empty">У пропозиції немає файлів.</p>
          <ul v-else class="review-file-list">
            <li v-for="file in candidateFiles" :key="file.fileId">
              <button
                type="button"
                class="review-file-button"
                :aria-current="file.fileId === selectedFileId ? 'true' : undefined"
                @click="emit('select', file.fileId)"
              >
                <span class="review-file-path">{{ file.path }}</span>
                <span class="review-file-kind">{{
                  file.contentKind === 'text' ? 'Текст' : 'Ресурс'
                }}</span>
              </button>
            </li>
          </ul>
          <div v-if="candidate.directories.length" class="review-directories">
            <h3>Папки</h3>
            <ul>
              <li v-for="directory in candidate.directories" :key="directory">{{ directory }}</li>
            </ul>
          </div>
        </section>

        <section class="review-panel review-detail-panel" aria-label="Перегляд змін">
          <template v-if="selectedFile">
            <header class="review-panel-heading review-selected-heading">
              <div>
                <h2>{{ selectedFile.path }}</h2>
                <p>
                  {{
                    selectedFile.contentKind === 'text' ? 'Текстовий файл' : selectedFile.mediaType
                  }}
                </p>
              </div>
              <button
                class="button button-secondary"
                type="button"
                :disabled="downloading"
                @click="emit('download', selectedFile.fileId)"
              >
                Завантажити
              </button>
            </header>
            <p class="review-file-meta">
              {{ formatBytes(selectedFile.sizeBytes) }}
            </p>
            <div v-if="fileLoading" class="review-state" role="status">Завантаження файла…</div>
            <div v-else-if="fileError" class="review-state" role="alert">{{ fileError }}</div>
            <pre
              v-else-if="fileText"
              class="review-source"
            ><code>{{ fileText.content }}</code></pre>
            <p v-else-if="selectedFile.contentKind === 'binary'" class="review-state">
              Попередній перегляд цього ресурсу недоступний.
            </p>
            <p v-else class="review-state">Виберіть файл, щоб переглянути його вміст.</p>
          </template>
          <p v-else class="review-state">Виберіть файл пропозиції, щоб переглянути його вміст.</p>
        </section>
      </div>
    </details>
  </section>
</template>

<style scoped>
.review-annotation-changes {
  display: grid;
  gap: 8px;
  overflow-wrap: anywhere;
}
.review-annotation-changes blockquote {
  margin: 4px 0;
  padding-inline-start: 8px;
  border-inline-start: 2px solid var(--color-border);
  white-space: pre-wrap;
}
.review-annotation-changes p {
  white-space: pre-wrap;
}
.review-changes {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.review-file-browser > summary {
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  background: var(--color-background);
}
.review-browser {
  display: grid;
  grid-template-columns: minmax(190px, 260px) minmax(0, 1fr);
  gap: 12px;
  min-width: 0;
}

.review-panel {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-panel);
  background: var(--color-surface);
}

.review-panel-heading,
.review-diff-file-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 42px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-background);
}

.review-panel-heading h2,
.review-diff-file-heading h3,
.review-directories h3,
.review-special-change h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.review-panel-heading > span,
.review-selected-heading p,
.review-file-kind,
.review-file-meta {
  color: var(--color-muted);
  font-size: 12px;
}

.review-selected-heading {
  align-items: flex-start;
}

.review-selected-heading > div {
  min-width: 0;
}
.review-selected-heading p {
  margin: 4px 0 0;
}

.review-file-list,
.review-directories ul,
.review-special-change ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.review-file-button {
  display: flex;
  width: 100%;
  min-height: 38px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 10px;
  border: 0;
  border-bottom: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text);
  text-align: left;
  cursor: pointer;
}

.review-file-button:hover {
  background: var(--color-background);
}
.review-file-button[aria-current='true'] {
  background: rgba(0, 127, 166, 0.08);
}
.review-file-path {
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 13px;
}

.review-directories,
.review-special-change {
  padding: 10px 12px;
  border-top: 1px solid var(--color-border);
}
.review-directories li,
.review-special-change li,
.review-special-change p {
  margin-top: 6px;
  color: var(--color-muted);
  font-size: 13px;
  overflow-wrap: anywhere;
}
.review-diff-file {
  border-top: 1px solid var(--color-border);
}
.review-diff-file-heading {
  background: transparent;
}
.review-change-labels {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 5px;
}
.review-change-labels span {
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--color-background);
  color: var(--color-muted);
  font-size: 11px;
}

.review-patch,
.review-source {
  max-height: 360px;
  margin: 0;
  overflow: auto;
  padding: 10px 12px;
  background: var(--color-surface);
  color: var(--color-text);
  font: 12px/1.55 var(--font-code);
  tab-size: 2;
  white-space: pre;
}
.review-source code,
.review-patch code {
  font: inherit;
}

.review-source {
  max-height: min(55vh, 640px);
}
.review-line-added {
  color: #176b3a;
  background: #eef8f0;
}
.review-line-deleted {
  color: #9f3030;
  background: #fff1f0;
}
.review-omitted,
.review-empty,
.review-state,
.review-file-meta {
  margin: 0;
  padding: 10px 12px;
  color: var(--color-muted);
  font-size: 13px;
}

@media (max-width: 720px) {
  .review-browser {
    grid-template-columns: minmax(0, 1fr);
  }
  .review-file-panel {
    max-height: 220px;
    overflow: auto;
  }
  .review-panel-heading {
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .review-panel-heading > span {
    margin-left: auto;
  }
  .review-diff-file-heading {
    align-items: flex-start;
  }
  .review-change-labels {
    max-width: 45%;
  }
  .review-patch,
  .review-source {
    max-height: 45vh;
  }
}
</style>
