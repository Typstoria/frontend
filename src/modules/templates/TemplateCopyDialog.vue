<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { useRouter } from 'vue-router';
import ModalDialog from '../../shared/ui/ModalDialog.vue';
import { titleError } from '../projects/projects-api';
import { createTemplatesApi, transferError, type Source } from './templates-api';

const props = defineProps<{ source: Source; templateTitle: string; keys: Map<string, string> }>();
const emit = defineEmits<{ dismiss: [] }>();
const router = useRouter();
const api = createTemplatesApi();
const controller = new AbortController();
const title = ref(props.templateTitle);
const input = ref<HTMLInputElement | null>(null);
const nameError = ref('');
const error = ref('');
const busy = ref(false);
onBeforeUnmount(() => controller.abort());

async function copy() {
  if (busy.value) return;
  nameError.value = titleError(title.value);
  if (nameError.value) return input.value?.focus();
  error.value = '';
  const name = title.value.trim();
  const key = props.keys.get(name) ?? crypto.randomUUID();
  props.keys.set(name, key);
  busy.value = true;
  try {
    const result = await api.copy(props.source, name, key, controller.signal);
    controller.signal.throwIfAborted();
    await router.push(`/projects/${result.projectId}`);
  } catch (cause) {
    if (!controller.signal.aborted)
      error.value = transferError(
        cause,
        'Не вдалося підтвердити створення. Повторіть спробу з тією самою назвою.',
      );
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <ModalDialog
    :open="true"
    title="Створити проєкт із шаблону"
    :busy="busy"
    @dismiss="emit('dismiss')"
  >
    <form novalidate @submit.prevent="copy">
      <div class="form-field">
        <label for="template-copy-title">Назва проєкту</label>
        <input
          id="template-copy-title"
          ref="input"
          v-model="title"
          autofocus
          autocomplete="off"
          :disabled="busy"
          :aria-invalid="!!nameError"
          :aria-describedby="nameError ? 'template-copy-error' : undefined"
          @input="nameError = ''"
        />
        <p v-if="nameError" id="template-copy-error" class="field-error" role="alert">
          {{ nameError }}
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
          {{ busy ? 'Створюємо…' : 'Створити проєкт' }}
        </button>
      </div>
    </form>
  </ModalDialog>
</template>
