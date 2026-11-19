<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import ModalDialog from '../../shared/ui/ModalDialog.vue';
import { fileNameError, filePathError, filePathInFolder, projectFolders } from './file-path';
import type { Snapshot } from './workspace-api';

import { compatibleResourcePaths, maxResourceBytes, resourceAccept } from './resource-formats';

const props = defineProps<{
  open: boolean;
  replacementPath?: string | undefined;
  directory: string;
  files: Snapshot['tree'];
  busy: boolean;
  uploading: boolean;
  locked: boolean;
  error: string;
}>();
const emit = defineEmits<{
  submit: [{ file: File; path: string }];
  retry: [];
  dismiss: [];
  closed: [];
}>();

const file = ref<File | null>(null);
const targetDirectory = ref('');
const fileName = ref('');
const fileNameEdited = ref(false);
const isReplacement = computed(() => props.replacementPath !== undefined);
const path = computed(() => filePathInFolder(targetDirectory.value, fileName.value));
const folderSuggestions = computed(() => projectFolders(props.files));
const nameError = computed(() =>
  !isReplacement.value && (file.value || fileName.value) ? fileNameError(fileName.value) : '',
);
const pathError = computed(() =>
  !isReplacement.value && fileName.value && !nameError.value
    ? filePathError(path.value, props.files)
    : '',
);
const validationError = computed(() => {
  if (!file.value) return 'Виберіть файл.';
  if (nameError.value) return nameError.value;
  if (!compatibleResourcePaths(file.value.name, file.value.name))
    return 'Виберіть файл підтримуваного типу.';
  if (!file.value.size) return 'Виберіть непорожній файл.';
  if (file.value.size > maxResourceBytes) return 'Файл має бути не більшим за 10 МіБ.';
  if (pathError.value) return pathError.value;
  if (!compatibleResourcePaths(file.value.name, props.replacementPath ?? path.value))
    return 'Розширення шляху має відповідати формату вибраного файла.';
  return '';
});

watch(
  () => [props.open, props.replacementPath, props.directory] as const,
  ([open]) => {
    if (!open) return;
    file.value = null;
    targetDirectory.value = props.directory;
    fileName.value = '';
    fileNameEdited.value = false;
  },
  { immediate: true },
);

function selectFile(event: Event) {
  const input = event.target as HTMLInputElement;
  file.value = input.files?.[0] ?? null;
  if (file.value && !fileNameEdited.value && !isReplacement.value) fileName.value = file.value.name;
}

function editFileName() {
  fileNameEdited.value = true;
}

function submit() {
  if (props.busy || props.locked || validationError.value || !file.value) return;
  emit('submit', {
    file: file.value,
    path: props.replacementPath ?? path.value,
  });
}

function dismiss() {
  if (!props.busy || props.uploading) emit('dismiss');
}
</script>

<template>
  <ModalDialog
    :open="open"
    :title="isReplacement ? 'Замінити файл' : 'Завантажити файл'"
    :busy="busy && !uploading"
    @dismiss="dismiss"
    @closed="emit('closed')"
  >
    <form novalidate @submit.prevent="submit">
      <div class="form-field">
        <div class="resource-picker">
          <label
            for="resource-file"
            class="button button-secondary"
            :class="{ 'picker-disabled': busy || locked }"
            >Вибрати файл</label
          >
          <input
            id="resource-file"
            type="file"
            :accept="resourceAccept"
            autofocus
            :disabled="busy || locked"
            :aria-invalid="!!file && !!validationError"
            :aria-describedby="file && validationError ? 'resource-error' : 'resource-hint'"
            @change="selectFile"
          />
          <span :title="file?.name">{{ file?.name ?? 'Файл не вибрано' }}</span>
        </div>
        <p id="resource-hint" class="field-hint">
          PNG, JPEG, GIF, WebP, PDF, TTF, OTF, WOFF або WOFF2. До 10 МіБ.
        </p>
      </div>

      <div v-if="isReplacement" class="form-field">
        <span class="field-label">Шлях ресурсу</span>
        <p class="resource-path">{{ replacementPath }}</p>
        <p class="field-hint">Вибраний файл замінить вміст цього ресурсу.</p>
      </div>
      <template v-else>
        <div class="form-field">
          <label for="resource-directory">Папка</label>
          <input
            id="resource-directory"
            v-model="targetDirectory"
            list="resource-folders"
            placeholder="Корінь проєкту"
            autocomplete="off"
            :disabled="busy || locked"
            :aria-invalid="!!pathError"
            :aria-describedby="pathError ? 'resource-error' : undefined"
          />
          <datalist id="resource-folders">
            <option v-for="folder in folderSuggestions" :key="folder" :value="folder" />
          </datalist>
        </div>
        <div class="form-field">
          <label for="resource-file-name">Назва файла</label>
          <input
            id="resource-file-name"
            v-model="fileName"
            autocomplete="off"
            :disabled="busy || locked"
            :aria-invalid="!!(nameError || pathError)"
            :aria-describedby="nameError || pathError ? 'resource-error' : undefined"
            @input="editFileName"
          />
        </div>
      </template>

      <p
        v-if="validationError && (file || fileName)"
        id="resource-error"
        class="field-error"
        role="alert"
      >
        {{ validationError }}
      </p>
      <p v-if="error" class="form-message form-error" role="alert">{{ error }}</p>
      <div class="modal-actions">
        <button
          type="button"
          class="button button-secondary"
          :disabled="busy && !uploading"
          @click="dismiss"
        >
          {{ locked ? 'Закрити' : 'Скасувати' }}
        </button>
        <button
          v-if="locked"
          type="button"
          class="button button-primary"
          :disabled="busy"
          @click="emit('retry')"
        >
          Повторити
        </button>
        <button
          v-else
          type="submit"
          class="button button-primary"
          :disabled="busy || !!validationError"
        >
          {{
            uploading
              ? 'Завантажуємо…'
              : busy
                ? 'Зачекайте…'
                : isReplacement
                  ? 'Замінити'
                  : 'Додати'
          }}
        </button>
      </div>
    </form>
  </ModalDialog>
</template>

<style scoped>
.field-label {
  display: block;
  margin-bottom: 9px;
  font-size: 13px;
  line-height: 1.4;
  font-weight: 600;
}

.resource-path {
  overflow-wrap: anywhere;
  margin: 0;
}

.resource-picker {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.resource-picker input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  clip-path: inset(50%);
}
.resource-picker label {
  flex-shrink: 0;
  min-height: 44px;
  margin: 0;
  cursor: pointer;
}
.resource-picker:focus-within label {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
.resource-picker span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}
.picker-disabled {
  opacity: 0.5;
  cursor: default !important;
}
</style>
