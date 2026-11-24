<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { ApiError } from '../../shared/api/client';
import { downloadBlob } from '../../shared/files/download';
import DocumentCover from '../../shared/ui/DocumentCover.vue';
import LoadError from '../../shared/ui/LoadError.vue';
import ModalDialog from '../../shared/ui/ModalDialog.vue';
import { identitySession } from '../identity/identity-session';
import { SHARED_TEMPLATE_PATH } from './share-navigation';
import TemplateContents from './TemplateContents.vue';
import TemplateCopyDialog from './TemplateCopyDialog.vue';
import TemplateSharesDialog from './TemplateSharesDialog.vue';
import { createTemplatesApi, transferError, type Preview, type Source } from './templates-api';

const props = defineProps<{
  source: Source;
  loadCover: (source: Source, signal: AbortSignal) => Promise<Blob>;
}>();
const api = createTemplatesApi();
const router = useRouter();
const controller = new AbortController();
const preview = ref<Preview | null>(null);
const loading = ref(true);
const missing = ref(false);
const error = ref('');
const downloadError = ref('');
const downloading = ref(false);
const dialog = ref<'copy' | 'shares' | 'delete' | null>(null);
const deleting = ref(false);
const deleteError = ref('');
const heading = ref<HTMLElement | null>(null);
const keys = new Map<string, string>();
onMounted(() => void load());
onBeforeUnmount(() => controller.abort());

async function load() {
  loading.value = true;
  missing.value = false;
  error.value = '';
  try {
    preview.value = await api.preview(props.source, controller.signal);
  } catch (cause) {
    if (controller.signal.aborted) return;
    missing.value = cause instanceof ApiError && cause.status === 404;
    if (!missing.value)
      error.value = transferError(cause, 'Перевірте з’єднання й повторіть спробу.');
  } finally {
    loading.value = false;
  }
  await nextTick();
  if (document.activeElement === document.body || document.activeElement?.id === 'main-content')
    heading.value?.focus({ preventScroll: true });
}

async function download() {
  if (props.source.kind === 'system' || !preview.value || downloading.value) return;
  downloading.value = true;
  downloadError.value = '';
  try {
    const zip = await api.download(props.source, controller.signal);
    controller.signal.throwIfAborted();
    downloadBlob(zip, `${preview.value.title.replace(/[\\/:*?"<>|]/g, '_')}.zip`);
  } catch (cause) {
    if (!controller.signal.aborted)
      downloadError.value = transferError(cause, 'Не вдалося завантажити ZIP. Спробуйте ще раз.');
  } finally {
    downloading.value = false;
  }
}

function copy() {
  if (!identitySession.isAuthenticated()) {
    void router.push({ path: '/auth/login', query: { returnTo: SHARED_TEMPLATE_PATH } });
    return;
  }
  dialog.value = 'copy';
}

async function remove() {
  if (props.source.kind !== 'owned' || deleting.value) return;
  deleteError.value = '';
  deleting.value = true;
  try {
    try {
      await api.remove(props.source.id, controller.signal);
    } catch (cause) {
      if (!(cause instanceof ApiError && cause.status === 404)) throw cause;
    }
    controller.signal.throwIfAborted();
    await router.replace({
      path: '/templates',
      query: { tab: 'owned' },
      state: { templateDeleted: true },
    });
  } catch (cause) {
    if (!controller.signal.aborted)
      deleteError.value = transferError(
        cause,
        'Не вдалося підтвердити видалення. Спробуйте ще раз.',
      );
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <div class="template-detail">
    <RouterLink
      v-if="source.kind !== 'shared'"
      class="template-back"
      :to="{ path: '/templates', query: source.kind === 'owned' ? { tab: 'owned' } : {} }"
    >
      <span aria-hidden="true">←</span> До шаблонів
    </RouterLink>
    <p v-if="loading" class="panel template-state muted" role="status">Завантажуємо шаблон…</p>
    <LoadError
      v-else-if="error"
      title="Не вдалося відкрити шаблон"
      :message="error"
      retry-label="Повторити"
      @retry="load"
    />
    <div v-else-if="missing" class="panel template-state">
      <h1>Шаблон недоступний</h1>
      <p v-if="source.kind === 'shared'" class="muted">
        Попросіть автора надіслати активне посилання.
      </p>
    </div>
    <template v-else-if="preview">
      <header class="template-detail-header">
        <div>
          <h1 ref="heading" tabindex="-1">{{ preview.title }}</h1>
          <p v-if="preview.description" class="muted">{{ preview.description }}</p>
        </div>
        <div class="template-detail-actions">
          <button class="button button-primary" @click="copy">
            {{ identitySession.user.value ? 'Створити проєкт' : 'Увійти, щоб створити проєкт' }}
          </button>
          <button
            v-if="source.kind === 'owned'"
            class="button button-secondary template-action-icon"
            aria-label="Поширити"
            title="Поширити"
            @click="dialog = 'shares'"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M8.7 10.7l6.6-3.9m-6.6 6.5 6.6 3.9" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="5" r="3" />
              <circle cx="18" cy="19" r="3" />
            </svg>
          </button>
          <button
            v-if="source.kind !== 'system'"
            class="button button-secondary template-action-icon"
            aria-label="Завантажити ZIP"
            :title="downloading ? 'Готуємо ZIP…' : 'Завантажити ZIP'"
            :aria-busy="downloading"
            :disabled="downloading"
            @click="download"
          >
            <svg
              v-if="downloading"
              class="template-action-progress"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              aria-hidden="true"
            >
              <path d="M21 12a9 9 0 1 1-9-9" />
            </svg>
            <svg
              v-else
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4" />
            </svg>
          </button>
        </div>
      </header>
      <p v-if="downloadError" class="form-message form-error" role="alert">{{ downloadError }}</p>
      <div class="template-detail-body">
        <DocumentCover
          class="template-cover template-cover-detail"
          unavailable-label="Прев’ю недоступне."
          :load="(signal) => loadCover(source, signal)"
        />
        <div class="template-detail-contents">
          <TemplateContents :source="source" :preview="preview" />
        </div>
      </div>
      <button
        v-if="source.kind === 'owned'"
        class="button button-quiet template-delete"
        @click="
          deleteError = '';
          dialog = 'delete';
        "
      >
        Видалити шаблон…
      </button>

      <TemplateCopyDialog
        v-if="dialog === 'copy'"
        :source="source"
        :template-title="preview.title"
        :keys="keys"
        @dismiss="dialog = null"
      />
      <TemplateSharesDialog
        v-if="dialog === 'shares' && source.kind === 'owned'"
        :template-id="source.id"
        :includes-context="preview.includeContext"
        @dismiss="dialog = null"
      />
      <ModalDialog
        v-if="dialog === 'delete'"
        :open="true"
        title="Видалити шаблон?"
        :busy="deleting"
        @dismiss="dialog = null"
      >
        <p class="template-delete-name">{{ preview.title }}</p>
        <p class="muted">
          Усі посилання на шаблон стануть недійсними. Створені проєкти залишаться доступними.
        </p>
        <p v-if="deleteError" class="form-message form-error" role="alert">{{ deleteError }}</p>
        <div class="modal-actions">
          <button
            autofocus
            class="button button-secondary"
            :disabled="deleting"
            @click="dialog = null"
          >
            Скасувати
          </button>
          <button class="button button-danger" :disabled="deleting" @click="remove">
            {{ deleting ? 'Видаляємо…' : 'Видалити' }}
          </button>
        </div>
      </ModalDialog>
    </template>
  </div>
</template>
