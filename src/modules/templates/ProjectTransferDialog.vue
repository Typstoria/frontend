<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { downloadBlob } from '../../shared/files/download';
import ModalDialog from '../../shared/ui/ModalDialog.vue';
import { titleError } from '../projects/projects-api';
import { createTemplatesApi, transferError, type OwnedTemplate } from './templates-api';
import './transfer.css';

const props = defineProps<{
  mode: 'template' | 'export';
  projectId: number;
  projectTitle: string;
  revisionId: number;
  revisionNumber: number;
  hasUnsavedChanges: boolean;
}>();
const emit = defineEmits<{ dismiss: [] }>();
const api = createTemplatesApi();
const controller = new AbortController();
const title = ref(props.projectTitle);
const description = ref('');
const includeContext = ref(false);
const nameError = ref('');
const error = ref('');
const busy = ref(false);
const created = ref<OwnedTemplate | null>(null);
const titleInput = ref<HTMLInputElement | null>(null);
const doneButton = ref<HTMLButtonElement | null>(null);
onBeforeUnmount(() => controller.abort());

async function submit() {
  if (busy.value || created.value) return;
  error.value = '';
  nameError.value = props.mode === 'template' ? titleError(title.value) : '';
  if (nameError.value) return titleInput.value?.focus();
  busy.value = true;
  try {
    if (props.mode === 'export') {
      const zip = await api.exportZip(
        props.projectId,
        props.revisionId,
        includeContext.value,
        controller.signal,
      );
      controller.signal.throwIfAborted();
      downloadBlob(zip, `${props.projectTitle.replace(/[\\/:*?"<>|]/g, '_')}.zip`);
      emit('dismiss');
    } else {
      created.value = await api.create(
        props.projectId,
        {
          title: title.value.trim(),
          description: description.value.trim(),
          revisionId: props.revisionId,
          includeContext: includeContext.value,
        },
        controller.signal,
      );
      controller.signal.throwIfAborted();
      // The form is replaced on success, so focus the remaining action.
      requestAnimationFrame(() => doneButton.value?.focus());
    }
  } catch (cause) {
    if (controller.signal.aborted) return;
    error.value = transferError(
      cause,
      props.mode === 'export'
        ? 'Не вдалося завантажити архів. Спробуйте ще раз.'
        : 'Не вдалося підтвердити створення. Перевірте «Мої шаблони» перед повторною спробою.',
    );
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <ModalDialog
    :open="true"
    :title="mode === 'template' ? 'Зберегти як шаблон' : 'Експортувати ZIP'"
    :busy="busy"
    @dismiss="emit('dismiss')"
  >
    <template v-if="created">
      <p role="status">Шаблон «{{ created.title }}» збережено.</p>
      <div class="modal-actions">
        <button ref="doneButton" class="button button-secondary" @click="emit('dismiss')">
          Готово
        </button>
        <RouterLink
          class="button button-primary"
          :to="{ path: '/templates', query: { owned: created.id } }"
          >Відкрити шаблон</RouterLink
        >
      </div>
    </template>
    <form v-else novalidate @submit.prevent="submit">
      <p class="muted transfer-revision">
        Збережена версія {{ revisionNumber
        }}<template v-if="hasUnsavedChanges">. Незбережені зміни не ввійдуть.</template>
      </p>
      <template v-if="mode === 'template'">
        <div class="form-field">
          <label for="snapshot-title">Назва шаблону</label>
          <input
            id="snapshot-title"
            ref="titleInput"
            v-model="title"
            autofocus
            autocomplete="off"
            :disabled="busy"
            :aria-invalid="!!nameError"
            :aria-describedby="nameError ? 'snapshot-title-error' : undefined"
            @input="nameError = ''"
          />
          <p v-if="nameError" id="snapshot-title-error" class="field-error" role="alert">
            {{ nameError }}
          </p>
        </div>
        <div class="form-field">
          <label for="snapshot-description">Опис (необов’язково)</label>
          <textarea
            id="snapshot-description"
            v-model="description"
            rows="3"
            maxlength="2000"
            :disabled="busy"
          />
        </div>
      </template>
      <label class="transfer-check">
        <input
          v-model="includeContext"
          type="checkbox"
          :disabled="busy"
          aria-describedby="snapshot-scope"
        />
        Додати контекст і матеріали
      </label>
      <p id="snapshot-scope" class="muted transfer-hint">
        {{
          includeContext
            ? 'Увійдуть файли, текст контексту й оригінали матеріалів.'
            : 'Увійдуть лише файли документа й ресурси.'
        }}
      </p>
      <p v-if="error" class="form-message form-error" role="alert">
        {{ error }}
        <RouterLink v-if="mode === 'template'" to="/templates?tab=owned">Мої шаблони</RouterLink>
      </p>
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
          {{ busy ? 'Зачекайте…' : mode === 'template' ? 'Зберегти шаблон' : 'Завантажити ZIP' }}
        </button>
      </div>
    </form>
  </ModalDialog>
</template>
