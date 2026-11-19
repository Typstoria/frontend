<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import ModalDialog from '../../shared/ui/ModalDialog.vue';
import FolderPicker from './FolderPicker.vue';
import { fileNameError, filePathError, filePathInFolder } from './file-path';
import type { Snapshot } from './workspace-api';

import { compatibleResourcePaths, maxResourceBytes, resourceAccept } from './resource-formats';
import { isTextUpload, maxTextUploadBytes, textUploadAccept } from './text-upload';

const maxProjectFiles = 200;
const maxSaveOperations = 200;

const props = defineProps<{
  open: boolean;
  replacementPath?: string | undefined;
  directory: string;
  directories: string[];
  files: Snapshot['tree'];
  busy: boolean;
  uploading: boolean;
  locked: boolean;
  error: string;
  initialFiles?: File[] | undefined;
}>();
const emit = defineEmits<{
  submit: [files: { file: File; path: string }[]];
  retry: [];
  dismiss: [];
  closed: [];
}>();

const selectedFiles = ref<File[]>([]);
const targetDirectory = ref('');
const fileName = ref('');
const fileNameEdited = ref(false);
const submitted = ref(false);
const isReplacement = computed(() => props.replacementPath !== undefined);
const uploadPaths = computed(() =>
  selectedFiles.value.map((selected) =>
    filePathInFolder(
      targetDirectory.value,
      selectedFiles.value.length === 1 && !isReplacement.value ? fileName.value : selected.name,
    ),
  ),
);
const validationError = computed(() => {
  if (!selectedFiles.value.length) return 'Виберіть файл.';
  const saveOperationCount = selectedFiles.value.length;
  if (saveOperationCount > maxSaveOperations)
    return `За одну дію можна додати не більше ${maxSaveOperations} файлів.`;
  if (!isReplacement.value) {
    const availableSlots = Math.max(0, maxProjectFiles - props.files.length);
    if (selectedFiles.value.length > availableSlots)
      return `У проєкті залишилося місць для ${availableSlots} файлів (максимум — ${maxProjectFiles}).`;
  }

  if (!isReplacement.value && selectedFiles.value.length === 1) {
    const nameError = fileNameError(fileName.value);
    if (nameError) return nameError;
  }

  const seenPaths: string[] = [];
  for (const [index, selected] of selectedFiles.value.entries()) {
    const target: string = isReplacement.value
      ? (props.replacementPath ?? '')
      : (uploadPaths.value[index] ?? '');
    const textFile = isTextUpload(selected);

    if (isReplacement.value && textFile)
      return 'Для заміни виберіть файл ресурсу підтримуваного типу.';
    const inputName =
      selectedFiles.value.length === 1 && !isReplacement.value ? fileName.value : selected.name;
    const nameError = fileNameError(inputName);
    if (!isReplacement.value && nameError) return nameError;
    if (!textFile && !compatibleResourcePaths(selected.name, selected.name))
      return 'Виберіть файл підтримуваного типу.';
    if (textFile && selected.size > maxTextUploadBytes)
      return 'Текстовий файл має бути не більшим за 1 МіБ.';
    if (!textFile && !selected.size) return 'Виберіть непорожній файл.';
    if (!textFile && selected.size > maxResourceBytes) return 'Файл має бути не більшим за 10 МіБ.';

    if (textFile) {
      if (!isTextUpload({ name: target }))
        return 'Шлях має закінчуватися на розширення текстового файла.';
    } else if (!compatibleResourcePaths(selected.name, target)) {
      return 'Розширення шляху має відповідати формату вибраного файла.';
    }

    if (isReplacement.value) continue;
    const invalidPath = filePathError(target, props.files);
    if (invalidPath) return invalidPath;
    if (
      props.directories.some((directory) => {
        const normalizedDirectory = directory.normalize('NFC');
        const normalizedTarget = target.normalize('NFC');
        return (
          normalizedDirectory === normalizedTarget ||
          normalizedDirectory.startsWith(`${normalizedTarget}/`)
        );
      })
    )
      return 'Папка з такою назвою вже існує.';
    const normalized = target.normalize('NFC');
    if (
      seenPaths.some((path) => {
        const previous = path.normalize('NFC');
        return (
          previous === normalized ||
          previous.startsWith(`${normalized}/`) ||
          normalized.startsWith(`${previous}/`)
        );
      })
    )
      return 'Шляхи вибраних файлів конфліктують.';
    seenPaths.push(target);
  }
  return '';
});
const visibleValidationError = computed(() =>
  !props.open || submitted.value ? '' : validationError.value,
);

watch(
  () => [props.open, props.replacementPath, props.directory, props.initialFiles] as const,
  ([open]) => {
    if (!open) return;
    selectedFiles.value = isReplacement.value ? [] : [...(props.initialFiles ?? [])];
    targetDirectory.value = props.directory;
    fileName.value = selectedFiles.value.length === 1 ? (selectedFiles.value[0]?.name ?? '') : '';
    fileNameEdited.value = false;
    submitted.value = false;
  },
  { immediate: true },
);
watch(targetDirectory, () => {
  submitted.value = false;
});

function selectFile(event: Event) {
  submitted.value = false;
  const input = event.target as HTMLInputElement;
  selectedFiles.value = [...(input.files ?? [])];
  if (selectedFiles.value.length === 1 && !fileNameEdited.value && !isReplacement.value)
    fileName.value = selectedFiles.value[0]?.name ?? '';
  else if (selectedFiles.value.length !== 1) {
    fileName.value = '';
    fileNameEdited.value = false;
  }
}

function editFileName() {
  submitted.value = false;
  fileNameEdited.value = true;
}

function submit() {
  if (!props.open || props.busy || props.locked || validationError.value) return;
  submitted.value = true;
  emit(
    'submit',
    selectedFiles.value.map((file, index) => ({
      file,
      path: isReplacement.value ? (props.replacementPath ?? '') : (uploadPaths.value[index] ?? ''),
    })),
  );
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
    dialog-class="workspace-action-dialog"
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
            :accept="isReplacement ? resourceAccept : `${resourceAccept},${textUploadAccept}`"
            :multiple="!isReplacement"
            autofocus
            :disabled="busy || locked"
            :aria-invalid="!!selectedFiles.length && !!visibleValidationError"
            :aria-describedby="
              selectedFiles.length && visibleValidationError ? 'resource-error' : 'resource-hint'
            "
            @change="selectFile"
          />
          <span v-if="!selectedFiles.length">Файл не вибрано</span>
          <span v-else-if="selectedFiles.length === 1" :title="selectedFiles[0]?.name">
            {{ selectedFiles[0]?.name }}
          </span>
          <span v-else>Файлів вибрано — {{ selectedFiles.length }}</span>
        </div>
        <p id="resource-hint" class="field-hint">
          <template v-if="isReplacement">
            PNG, JPEG, GIF, WebP, PDF, TTF, OTF, WOFF або WOFF2. До 10 МіБ.
          </template>
          <template v-else>
            PNG, JPEG, GIF, WebP, PDF, TTF, OTF, WOFF, WOFF2, Typst, TXT, MD, CSV, TSV, JSON, YAML,
            TOML або BIB. Ресурси — до 10 МіБ, текстові файли — до 1 МіБ.
          </template>
        </p>
        <ul v-if="selectedFiles.length > 1" class="selected-file-list" aria-label="Вибрані файли">
          <li v-for="(selected, index) in selectedFiles" :key="`${selected.name}-${index}`">
            {{ selected.name }}
          </li>
        </ul>
      </div>

      <div v-if="isReplacement" class="form-field">
        <span class="field-label">Шлях ресурсу</span>
        <p class="resource-path">{{ replacementPath }}</p>
        <p class="field-hint">Вибраний файл замінить вміст цього ресурсу.</p>
      </div>
      <template v-else>
        <FolderPicker
          id="resource-directory"
          v-model="targetDirectory"
          label="Папка"
          :directories="directories"
          :disabled="busy || locked"
        />
        <div v-if="selectedFiles.length <= 1" class="form-field">
          <label for="resource-file-name">Назва файла</label>
          <input
            id="resource-file-name"
            v-model="fileName"
            autocomplete="off"
            :disabled="busy || locked"
            :aria-invalid="!!visibleValidationError"
            :aria-describedby="visibleValidationError ? 'resource-error' : undefined"
            @input="editFileName"
          />
        </div>
      </template>

      <p
        v-if="visibleValidationError && (selectedFiles.length || fileName)"
        id="resource-error"
        class="field-error"
        role="alert"
      >
        {{ visibleValidationError }}
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
.selected-file-list {
  max-height: 120px;
  overflow: auto;
  margin: 8px 0 0;
  padding-left: 20px;
  font-size: 13px;
}
</style>
