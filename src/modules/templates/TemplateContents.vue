<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { downloadBlob } from '../../shared/files/download';
import { createTemplatesApi, transferError, type Preview, type Source } from './templates-api';

const props = defineProps<{ preview: Preview; source: Source }>();
const api = createTemplatesApi();
const controller = new AbortController();
const selected = ref('');
const text = ref('');
const fileError = ref('');
const busy = ref(false);
const formatSize = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 1 });
onBeforeUnmount(() => controller.abort());

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  return bytes < 1048576
    ? `${formatSize.format(bytes / 1024)} КіБ`
    : `${formatSize.format(bytes / 1048576)} МіБ`;
}
async function openFile(file: Preview['files'][number]) {
  if (busy.value || props.source.kind === 'system') return;
  if (file.contentKind === 'text' && selected.value === file.path && !fileError.value) {
    selected.value = '';
    text.value = '';
    return;
  }
  selected.value = file.path;
  text.value = '';
  fileError.value = '';
  busy.value = true;
  try {
    const data = await api.file(props.source, file, controller.signal);
    controller.signal.throwIfAborted();
    if (file.contentKind === 'text') text.value = await data.text();
    else downloadBlob(data, file.path.split('/').at(-1)!);
  } catch (cause) {
    if (!controller.signal.aborted)
      fileError.value = transferError(cause, 'Не вдалося відкрити файл. Спробуйте ще раз.');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="panel template-files" aria-label="Вміст шаблону">
    <div class="template-section-heading">
      <h2>Файли</h2>
      <span class="muted">{{ preview.files.length }}</span>
    </div>
    <ul class="template-file-list">
      <li v-for="file in preview.files" :key="file.path">
        <component
          :is="source.kind === 'system' ? 'div' : 'button'"
          class="template-file-row"
          :type="source.kind === 'system' ? undefined : 'button'"
          :aria-expanded="
            source.kind !== 'system' && file.contentKind === 'text'
              ? selected === file.path
              : undefined
          "
          :aria-disabled="source.kind !== 'system' && busy ? true : undefined"
          @click="openFile(file)"
        >
          <span class="template-file-name"
            >{{ file.path }}
            <small v-if="file.path === preview.entrypoint">Головний файл</small>
          </span>
          <span class="template-file-meta">
            <span class="muted">{{ fileSize(file.sizeBytes) }}</span>
            <svg
              v-if="source.kind !== 'system'"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              aria-hidden="true"
            >
              <path v-if="file.contentKind === 'binary'" d="M10 3v10m-4-4 4 4 4-4M4 14v3h12v-3" />
              <path v-else-if="selected === file.path" d="m5 12 5-5 5 5" />
              <path v-else d="m5 8 5 5 5-5" />
            </svg>
            <span
              v-if="source.kind !== 'system' && file.contentKind === 'binary'"
              class="template-sr-only"
              >Завантажити файл</span
            >
          </span>
        </component>
        <template v-if="selected === file.path">
          <p v-if="busy" class="template-file-feedback muted" role="status">Завантажуємо файл…</p>
          <p v-else-if="fileError" class="template-file-feedback field-error" role="alert">
            {{ fileError }}
          </p>
          <pre v-else-if="file.contentKind === 'text' && text" class="template-code" tabindex="0">{{
            text
          }}</pre>
          <p v-else-if="file.contentKind === 'text'" class="template-file-feedback muted">
            Файл порожній.
          </p>
        </template>
      </li>
    </ul>
    <details v-if="preview.directories.length" class="template-folders">
      <summary>Папки ({{ preview.directories.length }})</summary>
      <ul>
        <li v-for="directory in preview.directories" :key="directory">{{ directory }}/</li>
      </ul>
    </details>
  </section>
  <section
    v-if="preview.includeContext"
    class="panel template-files"
    aria-label="Контекст і матеріали"
  >
    <div class="template-section-heading"><h2>Контекст і матеріали</h2></div>
    <details v-if="preview.contextText" class="template-folders">
      <summary>Текст контексту</summary>
      <p class="template-context">{{ preview.contextText }}</p>
    </details>
    <ul v-if="preview.materials.length" class="template-file-list">
      <li v-for="material in preview.materials" :key="material.index" class="template-file-row">
        <span class="template-file-name"
          >{{ material.name }}<small>{{ material.filename }}</small></span
        >
        <span class="muted">{{ fileSize(material.sizeBytes) }}</span>
      </li>
    </ul>
    <p
      v-if="!preview.contextText && !preview.materials.length"
      class="template-file-feedback muted"
    >
      Контекст і матеріали відсутні.
    </p>
  </section>
  <section v-if="preview.annotationCount" class="panel template-files">
    <div class="template-section-heading">
      <h2>Коментарі</h2>
      <span class="muted">{{ preview.annotationCount }}</span>
    </div>
  </section>
</template>
