<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ApiError } from '../../shared/api/client';
import ModalDialog from '../../shared/ui/ModalDialog.vue';
import { titleError } from '../projects/projects-api';
import { createTemplatesApi, MAX_ZIP_BYTES, transferError } from './templates-api';

import './transfer.css';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ dismiss: [] }>();
const router = useRouter();
const api = createTemplatesApi();
const controller = new AbortController();
const title = ref('');
const file = ref<File | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const filePicker = ref<HTMLButtonElement | null>(null);
const titleInput = ref<HTMLInputElement | null>(null);
const entrypointInput = ref<HTMLSelectElement | null>(null);
const candidates = ref<string[]>([]);
const entrypoint = ref('');
const fileError = ref('');
const nameError = ref('');
const entrypointError = ref('');
const error = ref('');
const busy = ref(false);
const keys = new Map<string, string>();
const preserveAttempt = ref(false);
watch(
  () => props.open,
  (open) => {
    if (open || preserveAttempt.value) return;
    file.value = null;
    title.value = '';
    candidates.value = [];
    entrypoint.value = '';
    fileError.value = '';
    nameError.value = '';
    entrypointError.value = '';
    error.value = '';
    keys.clear();
  },
);
onBeforeUnmount(() => controller.abort());

function selectFile(event: Event) {
  const input = event.target as HTMLInputElement;
  file.value = input.files?.[0] ?? null;
  candidates.value = [];
  entrypoint.value = '';
  fileError.value = '';
  entrypointError.value = '';
  error.value = '';
  keys.clear();
  preserveAttempt.value = false;
  if (!title.value.trim() && file.value) title.value = file.value.name.replace(/\.zip$/i, '');
}

async function submit() {
  if (busy.value) return;
  const selected = file.value;
  fileError.value =
    !selected || !selected.size || !/\.zip$/i.test(selected.name)
      ? 'Виберіть ZIP-архів.'
      : selected.size > MAX_ZIP_BYTES
        ? 'Розмір ZIP-архіву має бути до 32 МіБ.'
        : '';
  nameError.value = titleError(title.value);
  entrypointError.value =
    candidates.value.length && !entrypoint.value ? 'Виберіть головний файл.' : '';
  error.value = '';
  if (fileError.value) return filePicker.value?.focus();
  if (nameError.value) return titleInput.value?.focus();
  if (entrypointError.value) return entrypointInput.value?.focus();
  if (!selected) return;
  const name = title.value.trim();
  const entry = entrypoint.value;
  const signature = JSON.stringify([name, entry]);
  const key = keys.get(signature) ?? crypto.randomUUID();
  keys.set(signature, key);
  busy.value = true;
  try {
    const result = await api.importZip(selected, name, entry, key, controller.signal);
    controller.signal.throwIfAborted();
    await router.push(`/projects/${result.projectId}`);
  } catch (cause) {
    if (controller.signal.aborted) return;
    preserveAttempt.value =
      !(cause instanceof ApiError) || cause.status >= 500 || cause.code === 'INVALID_RESPONSE';
    if (cause instanceof ApiError && cause.code === 'ENTRYPOINT_REQUIRED') {
      const paths = cause.details?.candidates;
      candidates.value = Array.isArray(paths)
        ? [
            ...new Set(
              paths.filter(
                (path): path is string => typeof path === 'string' && path.endsWith('.typ'),
              ),
            ),
          ]
        : [];
      if (candidates.value.length) entrypointError.value = 'Виберіть головний файл.';
      else fileError.value = 'В архіві немає головного файла Typst (.typ). Виберіть інший ZIP.';
    } else {
      error.value = transferError(
        cause,
        cause instanceof ApiError && [400, 415, 422].includes(cause.status)
          ? 'Не вдалося прочитати ZIP. Перевірте його файли або виберіть інший архів.'
          : 'Не вдалося підтвердити імпорт. Повторіть спробу з тим самим архівом і назвою.',
      );
    }
  } finally {
    busy.value = false;
    await nextTick();
    if (entrypointError.value) entrypointInput.value?.focus();
    else if (fileError.value) filePicker.value?.focus();
  }
}
</script>

<template>
  <ModalDialog :open="open" title="Імпортувати ZIP" :busy="busy" @dismiss="emit('dismiss')">
    <form novalidate @submit.prevent="submit">
      <div class="form-field">
        <label for="import-archive">ZIP-архів</label>
        <input
          id="import-archive"
          ref="fileInput"
          type="file"
          accept=".zip,application/zip"
          hidden
          :disabled="busy"
          @change="selectFile"
        />
        <div class="transfer-file-picker">
          <button
            ref="filePicker"
            type="button"
            class="button button-secondary"
            autofocus
            :disabled="busy"
            :aria-describedby="fileError ? 'import-file-error' : 'import-file-limit'"
            @click="fileInput?.click()"
          >
            {{ file ? 'Змінити архів' : 'Вибрати архів' }}
          </button>
          <span v-if="file" class="transfer-file-name" role="status">{{ file.name }}</span>
        </div>
        <p v-if="fileError" id="import-file-error" class="field-error" role="alert">
          {{ fileError }}
        </p>
        <p v-else id="import-file-limit" class="muted transfer-hint">До 32 МіБ.</p>
      </div>
      <div class="form-field">
        <label for="import-title">Назва проєкту</label>
        <input
          id="import-title"
          ref="titleInput"
          v-model="title"
          autocomplete="off"
          :disabled="busy"
          :aria-invalid="!!nameError"
          :aria-describedby="nameError ? 'import-name-error' : undefined"
          @input="nameError = ''"
        />
        <p v-if="nameError" id="import-name-error" class="field-error" role="alert">
          {{ nameError }}
        </p>
      </div>
      <div v-if="candidates.length" class="form-field">
        <label for="import-entrypoint">Головний файл Typst</label>
        <select
          id="import-entrypoint"
          ref="entrypointInput"
          v-model="entrypoint"
          :disabled="busy"
          :aria-invalid="!!entrypointError"
          :aria-describedby="entrypointError ? 'import-entry-error' : undefined"
          @change="entrypointError = ''"
        >
          <option disabled value="">Виберіть файл</option>
          <option v-for="candidate in candidates" :key="candidate">{{ candidate }}</option>
        </select>
        <p v-if="entrypointError" id="import-entry-error" class="field-error" role="alert">
          {{ entrypointError }}
        </p>
      </div>
      <p v-if="error" class="form-message form-error" role="alert">{{ error }}</p>
      <div class="modal-actions">
        <button
          type="button"
          class="button button-secondary"
          :disabled="busy"
          @click="emit('dismiss')"
        >
          Скасувати
        </button>
        <button class="button button-primary" :disabled="busy">
          {{ busy ? 'Імпортуємо…' : 'Імпортувати' }}
        </button>
      </div>
    </form>
  </ModalDialog>
</template>
