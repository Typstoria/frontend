<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import ModalDialog from '../../shared/ui/ModalDialog.vue';
import FolderPicker from './FolderPicker.vue';
import { fileNameError, filePathError, filePathInFolder, normalizeFilePath } from './file-path';
import type { Snapshot } from './workspace-api';
import { matchesResourceType } from './resource-formats';

export type WorkspaceFileAction =
  | { kind: 'create' | 'createDirectory'; directory: string; fileId?: never }
  | { kind: 'rename' | 'move' | 'delete' | 'entrypoint'; fileId: number }
  | {
      kind: 'renameDirectory' | 'moveDirectory' | 'deleteDirectory';
      directoryPath: string;
      fileId?: never;
    };

const props = defineProps<{
  open: boolean;
  action: WorkspaceFileAction | null;
  initialName?: string;
  files: Snapshot['tree'];
  directories: string[];
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

const directory = ref('');
const fileName = ref('');
const replacementId = ref<number | undefined>();
const currentFile = computed(() =>
  props.action && 'fileId' in props.action
    ? props.files.find((file) => file.fileId === props.action?.fileId)
    : undefined,
);
const currentDirectory = computed(() =>
  props.action && 'directoryPath' in props.action
    ? normalizeFilePath(props.action.directoryPath)
    : '',
);
const currentLocation = computed(() => {
  const currentPath = currentFile.value?.path ?? currentDirectory.value;
  const separator = currentPath.lastIndexOf('/');
  return separator < 0 ? '' : currentPath.slice(0, separator);
});
const directoryFileCount = computed(
  () => props.files.filter((file) => file.path.startsWith(`${currentDirectory.value}/`)).length,
);
const moving = computed(
  () => props.action?.kind === 'move' || props.action?.kind === 'moveDirectory',
);
const finalPath = computed(() => {
  if (props.action?.kind === 'create') return filePathInFolder(directory.value, fileName.value);
  if (props.action?.kind === 'rename')
    return filePathInFolder(currentLocation.value, fileName.value);
  if (props.action?.kind === 'move' && currentFile.value)
    return filePathInFolder(directory.value, currentFile.value.path.split('/').at(-1) ?? '');
  if (props.action?.kind === 'createDirectory')
    return filePathInFolder(directory.value, fileName.value);
  if (props.action?.kind === 'renameDirectory' || props.action?.kind === 'moveDirectory')
    return filePathInFolder(
      props.action.kind === 'renameDirectory' ? currentLocation.value : directory.value,
      fileName.value,
    );
  return '';
});
const needsReplacement = computed(() => {
  if (props.action?.kind === 'delete') return props.action.fileId === props.mainFileId;
  if (props.action?.kind === 'rename')
    return (
      props.action.fileId === props.mainFileId &&
      !normalizeFilePath(finalPath.value).endsWith('.typ')
    );
  return props.action?.kind === 'deleteDirectory' && directoryContainsMainFile.value;
});
const directoryContainsMainFile = computed(() => {
  const mainFile = props.files.find((file) => file.fileId === props.mainFileId);
  return (
    !!mainFile &&
    (mainFile.path === currentDirectory.value ||
      mainFile.path.startsWith(`${currentDirectory.value}/`))
  );
});
const candidates = computed(() =>
  props.files.filter(
    (file) =>
      file.fileId !== currentFile.value?.fileId &&
      file.contentKind === 'text' &&
      file.path.endsWith('.typ') &&
      (props.action?.kind !== 'deleteDirectory' ||
        !(
          file.path === currentDirectory.value || file.path.startsWith(`${currentDirectory.value}/`)
        )),
  ),
);
const moveDirectoryTargets = computed(() =>
  props.directories.filter(
    (folder) =>
      folder !== currentDirectory.value && !folder.startsWith(`${currentDirectory.value}/`),
  ),
);
const title = computed(() => {
  switch (props.action?.kind) {
    case 'create':
      return 'Новий файл';
    case 'createDirectory':
      return 'Нова папка';
    case 'rename':
      return 'Перейменувати файл';
    case 'move':
      return 'Перемістити файл';
    case 'delete':
      return 'Видалити файл?';
    case 'entrypoint':
      return 'Змінити головний файл?';
    case 'renameDirectory':
      return 'Перейменувати папку';
    case 'moveDirectory':
      return 'Перемістити папку';
    case 'deleteDirectory':
      return 'Видалити папку?';
    default:
      return '';
  }
});
const actionName = computed(() => {
  switch (props.action?.kind) {
    case 'create':
      return 'Створити файл';
    case 'createDirectory':
      return 'Створити папку';
    case 'rename':
    case 'renameDirectory':
      return 'Перейменувати';
    case 'move':
    case 'moveDirectory':
      return 'Перемістити';
    case 'delete':
    case 'deleteDirectory':
      return 'Видалити';
    case 'entrypoint':
      return 'Зробити головним';
    default:
      return '';
  }
});

function directoryCollision(target: string, excludeSubtree = ''): boolean {
  const normalized = normalizeFilePath(target);
  return props.directories.some((existing) => {
    const folder = normalizeFilePath(existing);
    if (excludeSubtree && (folder === excludeSubtree || folder.startsWith(`${excludeSubtree}/`)))
      return false;
    return folder === normalized;
  });
}

function filesOutsideDirectory(): Snapshot['tree'] {
  return props.files.filter(
    (file) =>
      !(file.path === currentDirectory.value || file.path.startsWith(`${currentDirectory.value}/`)),
  );
}

const validationError = computed(() => {
  const kind = props.action?.kind;
  if (kind === 'create' || kind === 'createDirectory') {
    const nameError = fileNameError(fileName.value, kind === 'createDirectory');
    if (nameError) return nameError;
    const error = filePathError(finalPath.value, props.files);
    if (error) return error;
    if (directoryCollision(finalPath.value)) return 'Папка з такою назвою вже існує.';
  }
  if (kind === 'rename' || kind === 'move') {
    if (kind === 'rename') {
      const nameError = fileNameError(fileName.value);
      if (nameError) return nameError;
    }
    const error = filePathError(finalPath.value, props.files, props.action?.fileId);
    if (error) return error;
    if (directoryCollision(finalPath.value)) return 'Папка з такою назвою вже існує.';
    if (
      currentFile.value?.contentKind === 'binary' &&
      !matchesResourceType(finalPath.value, currentFile.value.mediaType)
    )
      return 'Розширення шляху має відповідати формату ресурсу.';
  }
  if (kind === 'renameDirectory' || kind === 'moveDirectory') {
    if (kind === 'renameDirectory') {
      const nameError = fileNameError(fileName.value, true);
      if (nameError) return nameError;
    }
    const target = normalizeFilePath(finalPath.value);
    const error = filePathError(target, filesOutsideDirectory());
    if (error) return error;
    if (directoryCollision(target, currentDirectory.value))
      return 'Папка з такою назвою вже існує.';
    if (kind === 'moveDirectory' && target.startsWith(`${currentDirectory.value}/`))
      return 'Не можна перемістити папку всередину самої себе.';
  }
  if (needsReplacement.value) {
    if (!candidates.value.length)
      return kind === 'deleteDirectory'
        ? 'Спершу створіть інший файл із розширенням .typ поза цією папкою.'
        : 'Спершу створіть інший файл із розширенням .typ.';
    if (!candidates.value.some((file) => file.fileId === replacementId.value))
      return 'Виберіть новий головний файл.';
  }
  if (kind === 'entrypoint') {
    if (!currentFile.value) return 'Вибраний файл недоступний.';
    if (currentFile.value.contentKind !== 'text' || !currentFile.value.path.endsWith('.typ'))
      return 'Головним можна вибрати лише текстовий файл із розширенням .typ.';
  }
  return '';
});
const sameLocation = computed(() => moving.value && directory.value === currentLocation.value);

watch(
  () =>
    [
      props.open,
      props.action?.kind,
      props.initialName,
      props.action && 'fileId' in props.action
        ? props.action.fileId
        : props.action && 'directoryPath' in props.action
          ? props.action.directoryPath
          : props.action?.directory,
    ] as const,
  ([open]) => {
    if (!open) return;
    directory.value =
      props.action?.kind === 'create' || props.action?.kind === 'createDirectory'
        ? props.action.directory
        : '';
    fileName.value = props.initialName ?? '';
    if (props.initialName === undefined) {
      if (props.action?.kind === 'create') fileName.value = 'new.typ';
      if (props.action?.kind === 'createDirectory') fileName.value = 'new-folder';
      if (props.action?.kind === 'rename' || props.action?.kind === 'move')
        fileName.value = currentFile.value?.path.split('/').at(-1) ?? '';
      if (props.action?.kind === 'renameDirectory' || props.action?.kind === 'moveDirectory')
        fileName.value = currentDirectory.value.split('/').at(-1) ?? '';
    }
    if (props.action?.kind === 'rename' || props.action?.kind === 'renameDirectory')
      directory.value = currentLocation.value;
    if (moving.value) directory.value = currentLocation.value;
    replacementId.value = candidates.value[0]?.fileId;
  },
  { immediate: true },
);
watch([fileName, directory, needsReplacement], () => {
  if (replacementId.value && !candidates.value.some((file) => file.fileId === replacementId.value))
    replacementId.value = candidates.value[0]?.fileId;
});

function submit() {
  if (props.busy || props.locked || !props.action || validationError.value || sameLocation.value)
    return;
  const replacement =
    needsReplacement.value && replacementId.value !== undefined
      ? { replacementId: replacementId.value }
      : {};
  if (
    ['create', 'createDirectory', 'rename', 'renameDirectory', 'move', 'moveDirectory'].includes(
      props.action.kind,
    )
  ) {
    emit('submit', { path: normalizeFilePath(finalPath.value), ...replacement });
  } else if (props.action.kind === 'delete' || props.action.kind === 'deleteDirectory') {
    emit('submit', {
      path:
        (props.action.kind === 'delete' ? currentFile.value?.path : currentDirectory.value) ?? '',
      ...replacement,
    });
  } else emit('submit', {});
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
    dialog-class="workspace-action-dialog"
    @dismiss="dismiss"
    @closed="emit('closed')"
  >
    <form v-if="action" novalidate @submit.prevent="submit">
      <p v-if="moving" class="file-action-source">{{ currentFile?.path ?? currentDirectory }}</p>
      <FolderPicker
        v-if="
          action.kind === 'create' ||
          action.kind === 'createDirectory' ||
          action.kind === 'move' ||
          action.kind === 'moveDirectory'
        "
        id="file-action-directory"
        v-model="directory"
        :label="
          action.kind === 'move' || action.kind === 'moveDirectory' ? 'Перемістити до' : 'Папка'
        "
        :directories="action.kind === 'moveDirectory' ? moveDirectoryTargets : directories"
        :disabled="busy || locked"
      />
      <div
        v-if="['create', 'createDirectory', 'rename', 'renameDirectory'].includes(action.kind)"
        class="form-field"
      >
        <span
          v-if="action.kind === 'rename' || action.kind === 'renameDirectory'"
          class="field-label"
          >Поточне розташування</span
        >
        <p
          v-if="action.kind === 'rename' || action.kind === 'renameDirectory'"
          class="read-only-location"
        >
          {{ currentLocation || 'Корінь проєкту' }}
        </p>
        <label for="file-action-name">{{
          action.kind === 'createDirectory' || action.kind === 'renameDirectory'
            ? 'Назва папки'
            : 'Назва файла'
        }}</label>
        <input
          id="file-action-name"
          v-model="fileName"
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
      <template v-else-if="action.kind === 'deleteDirectory'">
        <p class="delete-project-name">{{ currentDirectory }}</p>
        <p class="muted">
          {{
            directoryFileCount
              ? 'Папку з усім вмістом буде видалено з поточної версії проєкту.'
              : 'Папку буде видалено з поточної версії проєкту.'
          }}
        </p>
        <p v-if="directoryContainsMainFile" class="muted">
          Папка містить головний файл. Виберіть інший файл поза папкою.
        </p>
        <p v-if="dirty" class="muted">Незбережений текст буде втрачено.</p>
      </template>
      <template v-else-if="action.kind === 'entrypoint'">
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
          :autofocus="
            action.kind === 'delete' ||
            action.kind === 'deleteDirectory' ||
            action.kind === 'entrypoint'
          "
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
          :class="
            action.kind === 'delete' || action.kind === 'deleteDirectory'
              ? 'button-danger'
              : 'button-primary'
          "
          :disabled="busy || !!validationError || sameLocation"
        >
          {{ busy ? 'Зачекайте…' : actionName }}
        </button>
      </div>
    </form>
  </ModalDialog>
</template>

<style scoped>
.field-label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  line-height: 1.4;
  font-weight: 600;
}
.read-only-location {
  margin: 0 0 12px;
  overflow-wrap: anywhere;
  color: var(--color-muted);
  font-size: 13px;
}
.file-action-source {
  margin: 0 0 14px;
  overflow-wrap: anywhere;
  font-weight: 600;
}
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
