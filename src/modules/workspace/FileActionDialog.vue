<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import ModalDialog from '../../shared/ui/ModalDialog.vue';
import {
  fileNameError,
  filePathError,
  filePathInFolder,
  normalizeFilePath,
  projectFolders,
} from './file-path';
import type { Snapshot } from './workspace-api';
import { matchesResourceType } from './resource-formats';

type Action =
  | { kind: 'create'; directory: string }
  | { kind: 'rename' | 'delete' | 'entrypoint'; fileId: number };

const props = defineProps<{
  open: boolean;
  action: Action | null;
  files: Snapshot['tree'];
  mainFileId: number;
  dirty: boolean;
  busy: boolean;
  locked: boolean;
  error: string;
}>();
const emit = defineEmits<{
  submit: [{ path?: string; replacementId?: number }];
  retry: [];
  dismiss: [];
  closed: [];
}>();

const path = ref('');
const directory = ref('');
const fileName = ref('new.typ');
const replacementId = ref<number | undefined>();
const currentFile = computed(() =>
  props.files.find(
    (file) => file.fileId === (props.action?.kind === 'create' ? undefined : props.action?.fileId),
  ),
);
const candidates = computed(() =>
  props.files.filter(
    (file) =>
      file.fileId !== (props.action?.kind === 'create' ? undefined : props.action?.fileId) &&
      file.contentKind === 'text' &&
      file.path.endsWith('.typ'),
  ),
);
const folderSuggestions = computed(() => projectFolders(props.files));
const createPath = computed(() => filePathInFolder(directory.value, fileName.value));
const needsReplacement = computed(() =>
  props.action?.kind === 'delete'
    ? props.action.fileId === props.mainFileId
    : props.action?.kind === 'rename' &&
      props.action.fileId === props.mainFileId &&
      !normalizeFilePath(path.value).endsWith('.typ'),
);
const title = computed(() => {
  switch (props.action?.kind) {
    case 'create':
      return 'Новий файл';
    case 'rename':
      return 'Перейменувати файл';
    case 'delete':
      return 'Видалити файл?';
    case 'entrypoint':
      return 'Змінити головний файл?';
    default:
      return '';
  }
});
const actionName = computed(() => {
  switch (props.action?.kind) {
    case 'create':
      return 'Створити';
    case 'rename':
      return 'Перейменувати';
    case 'delete':
      return 'Видалити';
    case 'entrypoint':
      return 'Зробити головним';
    default:
      return '';
  }
});
const validationError = computed(() => {
  if (props.action?.kind === 'create') {
    const nameError = fileNameError(fileName.value);
    if (nameError) return nameError;
    const error = filePathError(createPath.value, props.files);
    if (error) return error;
  }
  if (props.action?.kind === 'rename') {
    const error = filePathError(path.value, props.files, props.action.fileId);
    if (error) return error;
    if (
      props.action.kind === 'rename' &&
      currentFile.value?.contentKind === 'binary' &&
      !matchesResourceType(path.value, currentFile.value.mediaType)
    )
      return 'Розширення шляху має відповідати формату ресурсу.';
  }
  if (needsReplacement.value) {
    if (!candidates.value.length) return 'Спершу створіть інший файл із розширенням .typ.';
    if (!candidates.value.some((file) => file.fileId === replacementId.value))
      return 'Виберіть новий головний файл.';
  }
  if (props.action?.kind === 'entrypoint') {
    if (!currentFile.value) return 'Вибраний файл недоступний.';
    if (currentFile.value.contentKind !== 'text' || !currentFile.value.path.endsWith('.typ'))
      return 'Головним можна вибрати лише текстовий файл із розширенням .typ.';
  }
  return '';
});

watch(
  () =>
    [
      props.open,
      props.action?.kind,
      props.action?.kind === 'create' ? props.action.directory : props.action?.fileId,
    ] as const,
  ([open]) => {
    if (!open) return;
    if (props.action?.kind === 'create') {
      directory.value = props.action.directory;
      fileName.value = 'new.typ';
      path.value = '';
    } else if (props.action?.kind === 'rename') {
      path.value = currentFile.value?.path ?? '';
    }
    replacementId.value = candidates.value[0]?.fileId;
  },
  { immediate: true },
);
watch([path, needsReplacement], () => {
  if (replacementId.value && !candidates.value.some((file) => file.fileId === replacementId.value))
    replacementId.value = candidates.value[0]?.fileId;
});

function submit() {
  if (props.busy || props.locked || !props.action || validationError.value) return;
  if (props.action.kind === 'create' || props.action.kind === 'rename') {
    emit('submit', {
      path: normalizeFilePath(props.action.kind === 'create' ? createPath.value : path.value),
      ...(needsReplacement.value && replacementId.value !== undefined
        ? { replacementId: replacementId.value }
        : {}),
    });
  } else if (props.action.kind === 'delete') {
    emit(
      'submit',
      needsReplacement.value && replacementId.value !== undefined
        ? { replacementId: replacementId.value }
        : {},
    );
  } else {
    emit('submit', {});
  }
}

function dismiss() {
  if (!props.busy) emit('dismiss');
}
</script>

<template>
  <ModalDialog
    :open="open && !!action"
    :title="title"
    :busy="busy"
    @dismiss="dismiss"
    @closed="emit('closed')"
  >
    <form v-if="action" novalidate @submit.prevent="submit">
      <template v-if="action.kind === 'create'">
        <div class="form-field">
          <label for="file-action-directory">Папка</label>
          <input
            id="file-action-directory"
            v-model="directory"
            list="file-action-folders"
            placeholder="Корінь проєкту"
            autocomplete="off"
            :disabled="busy || locked"
            :aria-invalid="!!validationError"
            :aria-describedby="validationError ? 'file-action-error' : undefined"
          />
          <datalist id="file-action-folders">
            <option v-for="folder in folderSuggestions" :key="folder" :value="folder" />
          </datalist>
        </div>
        <div class="form-field">
          <label for="file-action-path">Назва файла</label>
          <input
            id="file-action-path"
            v-model="fileName"
            autofocus
            autocomplete="off"
            :disabled="busy || locked"
            :aria-invalid="!!validationError"
            :aria-describedby="validationError ? 'file-action-error' : undefined"
          />
        </div>
      </template>
      <div v-else-if="action.kind === 'rename'" class="form-field">
        <label for="file-action-path">Шлях файла</label>
        <input
          id="file-action-path"
          v-model="path"
          autofocus
          autocomplete="off"
          :disabled="busy || locked"
          :aria-invalid="!!validationError"
          :aria-describedby="validationError ? 'file-action-error' : undefined"
        />
      </div>
      <template v-else-if="action.kind === 'delete'">
        <p class="delete-project-name">{{ currentFile?.path }}</p>
        <p class="muted">Файл буде видалено з поточної версії проєкту.</p>
        <p v-if="dirty" class="muted">Незбережений текст буде втрачено.</p>
      </template>
      <template v-else>
        <p class="delete-project-name">{{ currentFile?.path }}</p>
      </template>

      <div v-if="needsReplacement" class="form-field">
        <label for="file-action-replacement">Новий головний файл</label>
        <select
          id="file-action-replacement"
          v-model="replacementId"
          :disabled="busy || locked || !candidates.length"
        >
          <option v-for="file in candidates" :key="file.fileId" :value="file.fileId">
            {{ file.path }}
          </option>
        </select>
      </div>

      <p v-if="validationError" id="file-action-error" class="field-error" role="alert">
        {{ validationError }}
      </p>
      <p v-if="error" class="form-message form-error" role="alert">{{ error }}</p>
      <div class="modal-actions">
        <button
          type="button"
          class="button button-secondary"
          :disabled="busy"
          :autofocus="action.kind === 'delete' || action.kind === 'entrypoint'"
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
          class="button"
          :class="action.kind === 'delete' ? 'button-danger' : 'button-primary'"
          :disabled="busy || !!validationError"
        >
          {{ busy ? 'Зачекайте…' : actionName }}
        </button>
      </div>
    </form>
  </ModalDialog>
</template>

<style scoped>
select {
  width: 100%;
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
}
</style>
