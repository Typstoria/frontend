<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import ModalDialog from '../../shared/ui/ModalDialog.vue';
import { createTemplatesApi, transferError, type Share } from './templates-api';

const props = defineProps<{
  templateId: number;
  includesContext: boolean;
  includesAnnotations: boolean;
  returnFocus: HTMLElement | null;
}>();
const emit = defineEmits<{ dismiss: [] }>();
const api = createTemplatesApi();
const controller = new AbortController();
const shares = ref<Share[]>([]);
const cursor = ref<number | null>(null);
const loading = ref(false);
const loadError = ref('');
const failedMore = ref(false);
const days = ref(7);
const busy = ref(false);
const error = ref('');
const notice = ref('');
const newLink = ref<{ id: number; shareUrl: string; expiresAt: string } | null>(null);
const linkInput = ref<HTMLInputElement | null>(null);
const copyButton = ref<HTMLButtonElement | null>(null);
const expiryInput = ref<HTMLSelectElement | null>(null);
const dateFormat = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'medium', timeStyle: 'short' });
onMounted(() => void load());
onBeforeUnmount(() => controller.abort());

async function load(more = false) {
  if (loading.value) return;
  loading.value = true;
  loadError.value = '';
  failedMore.value = more;
  try {
    const page = await api.shares(
      props.templateId,
      controller.signal,
      more ? (cursor.value ?? undefined) : undefined,
    );
    shares.value = more ? [...shares.value, ...page.items] : page.items;
    cursor.value = page.nextCursor;
  } catch (cause) {
    if (!controller.signal.aborted)
      loadError.value = transferError(cause, 'Не вдалося завантажити посилання.');
  } finally {
    loading.value = false;
  }
}
async function create() {
  if (busy.value || loading.value) return;
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    newLink.value = await api.createShare(props.templateId, days.value, controller.signal);
    await nextTick();
    copyButton.value?.focus();
  } catch (cause) {
    if (!controller.signal.aborted)
      error.value = transferError(
        cause,
        'Не вдалося підтвердити створення посилання. Перевірте список нижче.',
      );
  } finally {
    if (!controller.signal.aborted) await load();
    busy.value = false;
  }
}
async function copy() {
  if (!newLink.value) return;
  try {
    await navigator.clipboard.writeText(newLink.value.shareUrl);
    notice.value = 'Посилання скопійовано.';
  } catch {
    linkInput.value?.focus();
    linkInput.value?.select();
    notice.value = 'Скопіюйте виділене посилання вручну.';
  }
}
async function revoke(item: Share) {
  if (busy.value || loading.value) return;
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    await api.revoke(props.templateId, item.id, controller.signal);
    if (newLink.value?.id === item.id) newLink.value = null;
    shares.value = shares.value.map((share) =>
      share.id === item.id ? { ...share, revokedAt: new Date().toISOString() } : share,
    );
    notice.value = 'Посилання відкликано.';
  } catch (cause) {
    if (!controller.signal.aborted)
      error.value = transferError(cause, 'Не вдалося відкликати посилання. Спробуйте ще раз.');
  } finally {
    busy.value = false;
  }
  if (!error.value && !controller.signal.aborted) {
    await nextTick();
    expiryInput.value?.focus();
  }
}
function status(share: Share) {
  if (share.revokedAt) return 'Відкликано';
  return Date.parse(share.expiresAt) <= Date.now() ? 'Строк дії минув' : 'Активне';
}
</script>

<template>
  <ModalDialog
    :open="true"
    title="Поширити шаблон"
    :busy="busy"
    :return-focus="returnFocus"
    dialog-class="template-share-dialog"
    @dismiss="emit('dismiss')"
  >
    <p class="muted">
      За посиланням можна переглянути шаблон і створити з нього проєкт.
      <template v-if="includesContext && includesAnnotations">
        Контекст, матеріали й коментарі також будуть доступні.
      </template>
      <template v-else-if="includesContext">Контекст і матеріали також будуть доступні.</template>
      <template v-else-if="includesAnnotations">Коментарі також будуть доступні.</template>
    </p>
    <form class="template-share-form" @submit.prevent="create">
      <div class="form-field">
        <label for="share-days">Строк дії</label>
        <select id="share-days" ref="expiryInput" v-model.number="days" autofocus :disabled="busy">
          <option :value="1">1 день</option>
          <option :value="7">7 днів</option>
          <option :value="30">30 днів</option>
          <option :value="90">90 днів</option>
        </select>
      </div>
      <button class="button button-primary" :disabled="busy || loading">Створити посилання</button>
    </form>
    <div v-if="newLink" class="template-link-box">
      <label for="created-share-link">Нове посилання</label>
      <div class="template-link-row">
        <input
          id="created-share-link"
          ref="linkInput"
          :value="newLink.shareUrl"
          readonly
          @focus="linkInput?.select()"
        />
        <button ref="copyButton" type="button" class="button button-secondary" @click="copy">
          Скопіювати
        </button>
      </div>
      <p class="muted transfer-hint">Збережіть посилання перед закриттям цього вікна.</p>
    </div>
    <p v-if="notice" class="transfer-hint" role="status">{{ notice }}</p>
    <p v-if="error" class="form-message form-error" role="alert">{{ error }}</p>
    <section class="template-share-list" aria-labelledby="share-list-title" :aria-busy="loading">
      <h3 id="share-list-title">Посилання</h3>
      <p v-if="loading" class="muted" role="status">Завантажуємо посилання…</p>
      <div v-if="loadError" role="alert">
        <p class="field-error">{{ loadError }}</p>
        <button class="button button-secondary" @click="load(failedMore)">Повторити</button>
      </div>
      <p v-else-if="!loading && !shares.length" class="muted">Посилань ще немає.</p>
      <ul v-if="shares.length">
        <li v-for="item in shares" :key="item.id">
          <div>
            <strong>{{ status(item) }}</strong>
            <small>Створено {{ dateFormat.format(new Date(item.createdAt)) }}</small>
            <small v-if="status(item) === 'Активне'"
              >Діє до {{ dateFormat.format(new Date(item.expiresAt)) }}</small
            >
          </div>
          <button
            v-if="status(item) === 'Активне'"
            class="button button-secondary danger-text"
            :disabled="busy || loading"
            :aria-label="`Відкликати посилання від ${dateFormat.format(new Date(item.createdAt))}`"
            @click="revoke(item)"
          >
            Відкликати
          </button>
        </li>
      </ul>
      <button
        v-if="cursor && !loadError"
        class="button button-secondary"
        :disabled="loading || busy"
        @click="load(true)"
      >
        Завантажити ще
      </button>
    </section>
    <div class="modal-actions">
      <button class="button button-secondary" :disabled="busy" @click="emit('dismiss')">
        Закрити
      </button>
    </div>
  </ModalDialog>
</template>
