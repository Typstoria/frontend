<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import ModalDialog from '../../shared/ui/ModalDialog.vue';
import PasswordField from './PasswordField.vue';
import OAuthConnections from './OAuthConnections.vue';
import { identitySession } from './identity-session';
import { describeAuthError } from './auth-errors';
import type { Account } from './identity-api';

const { user } = identitySession;
const account = ref<Account | null>(null);
const loading = ref(false);
const error = ref('');
const notice = ref('');
const dialog = ref<'name' | 'password' | 'delete' | null>(null);
const dialogOpen = ref(false);
const busy = ref(false);
const name = ref('');
const currentPassword = ref('');
const newPassword = ref('');
const fieldError = ref('');
const mutationError = ref('');
const cooldown = ref(0);
const controller = new AbortController();
let cooldownTimer: ReturnType<typeof setInterval> | undefined;
const dialogTitle = computed(() =>
  dialog.value === 'name'
    ? 'Редагувати ім’я'
    : dialog.value === 'password'
      ? 'Змінити пароль'
      : 'Видалити акаунт?',
);

async function load() {
  if (loading.value) return;
  loading.value = true;
  error.value = '';
  try {
    const profile = await identitySession.refreshProfile(controller.signal);
    if (!controller.signal.aborted) account.value = profile;
  } catch {
    if (!controller.signal.aborted) error.value = 'Не вдалося завантажити дані облікового запису.';
  } finally {
    loading.value = false;
  }
}
function open(kind: 'name' | 'password' | 'delete') {
  if (!account.value || loading.value || busy.value || dialog.value) return;
  dialog.value = kind;
  name.value = user.value?.name ?? '';
  fieldError.value = '';
  mutationError.value = '';
  notice.value = '';
  dialogOpen.value = true;
}
function dismiss() {
  if (!busy.value) dialogOpen.value = false;
}
function closed() {
  dialog.value = null;
  name.value = '';
  currentPassword.value = '';
  newPassword.value = '';
}
function startCooldown() {
  const until = Date.now() + 300_000;
  cooldown.value = 300;
  if (cooldownTimer) clearInterval(cooldownTimer);
  cooldownTimer = setInterval(() => {
    cooldown.value = Math.max(0, Math.ceil((until - Date.now()) / 1000));
    if (!cooldown.value) clearInterval(cooldownTimer);
  }, 1000);
}
async function submit() {
  const kind = dialog.value;
  if (!kind || busy.value || (kind === 'delete' && cooldown.value)) return;
  fieldError.value = '';
  mutationError.value = '';
  const trimmed = name.value.trim();
  if (kind === 'name' && (!trimmed || Array.from(trimmed).length > 80 || /\p{Cc}/u.test(trimmed))) {
    fieldError.value = 'Ім’я має містити від 1 до 80 символів, без керівних символів.';
    return;
  }
  if (
    kind === 'password' &&
    (!currentPassword.value ||
      Array.from(newPassword.value).length < 6 ||
      Array.from(newPassword.value).length > 128)
  ) {
    fieldError.value = 'Вкажіть поточний пароль і новий пароль від 6 до 128 символів.';
    return;
  }
  busy.value = true;
  try {
    if (kind === 'name') {
      account.value = await identitySession.updateProfile(trimmed, controller.signal);
      notice.value = 'Ім’я збережено.';
    } else if (kind === 'password') {
      await identitySession.changePassword(
        currentPassword.value,
        newPassword.value,
        controller.signal,
      );
    } else {
      await identitySession.requestAccountDeletion(controller.signal);
      notice.value =
        'Запит прийнято. Перевірте пошту та папку «Спам». Для видалення перейдіть за посиланням у листі й підтвердьте дію.';
      startCooldown();
    }
    if (!controller.signal.aborted) dialogOpen.value = false;
  } catch (cause) {
    if (!controller.signal.aborted) mutationError.value = describeAuthError(cause).message;
  } finally {
    currentPassword.value = '';
    newPassword.value = '';
    busy.value = false;
  }
}
onMounted(load);
onBeforeUnmount(() => {
  controller.abort();
  currentPassword.value = '';
  newPassword.value = '';
  if (cooldownTimer) clearInterval(cooldownTimer);
});
</script>

<template>
  <section class="page account-page" aria-labelledby="account-title">
    <h1 id="account-title">Обліковий запис</h1>
    <div v-if="error" class="form-message form-error" role="alert">
      <p>{{ error }}</p>
      <button class="text-button" :disabled="loading" @click="load">Повторити</button>
    </div>
    <p v-if="loading" class="muted" role="status">Завантаження облікового запису…</p>
    <p v-if="notice" class="form-message form-success" role="status">{{ notice }}</p>
    <div class="panel account-settings" :aria-busy="loading">
      <section class="account-setting" aria-labelledby="account-name-label">
        <div class="account-setting-value">
          <h2 id="account-name-label">Ім’я</h2>
          <p class="account-name">{{ user?.name || 'Не вказано' }}</p>
        </div>
        <button
          class="button button-secondary"
          :disabled="!account || loading"
          aria-label="Редагувати ім’я"
          @click="open('name')"
        >
          Редагувати
        </button>
      </section>
      <section class="account-setting" aria-labelledby="account-email-label">
        <div class="account-setting-value">
          <h2 id="account-email-label">Електронна пошта</h2>
          <div class="account-email-row">
            <p class="account-email">{{ user?.email }}</p>
            <span v-if="account && user?.emailVerified" class="account-verified">
              <svg
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="m4 10 4 4 8-8" />
              </svg>
              Підтверджено
            </span>
          </div>
        </div>
      </section>
      <section
        v-if="account?.hasPassword"
        class="account-setting"
        aria-labelledby="account-password-label"
      >
        <h2 id="account-password-label">Пароль</h2>
        <button class="button button-secondary" @click="open('password')">Змінити пароль</button>
      </section>
      <section class="account-setting" aria-labelledby="account-delete-label">
        <h2 id="account-delete-label">Видалення акаунта</h2>
        <button
          class="button button-secondary danger-text"
          :disabled="!account || loading || cooldown > 0"
          @click="open('delete')"
        >
          Видалити акаунт
        </button>
      </section>
    </div>
    <p v-if="cooldown" class="field-hint">
      Новий лист для видалення можна запросити через {{ Math.floor(cooldown / 60) }}:{{
        String(cooldown % 60).padStart(2, '0')
      }}.
    </p>
    <OAuthConnections />

    <ModalDialog
      :open="dialogOpen"
      :title="dialogTitle"
      :busy="busy"
      @dismiss="dismiss"
      @closed="closed"
    >
      <form v-if="dialog" :aria-busy="busy" @submit.prevent="submit">
        <div v-if="dialog === 'name'" class="form-field">
          <label for="account-name">Ім’я</label>
          <input
            id="account-name"
            v-model="name"
            autocomplete="name"
            autofocus
            :disabled="busy"
            :aria-invalid="!!fieldError"
            :aria-describedby="fieldError ? 'name-hint account-field-error' : 'name-hint'"
          />
          <p id="name-hint" class="field-hint">Від 1 до 80 символів.</p>
        </div>
        <template v-else-if="dialog === 'password'">
          <div class="form-field">
            <label for="current-password">Поточний пароль</label
            ><PasswordField
              id="current-password"
              v-model="currentPassword"
              autocomplete="current-password"
              autofocus
              :min-length="1"
              :disabled="busy"
              :invalid="!!mutationError"
            />
          </div>
          <div class="form-field">
            <label for="new-password">Новий пароль</label
            ><PasswordField
              id="new-password"
              v-model="newPassword"
              autocomplete="new-password"
              :min-length="6"
              :disabled="busy"
              describedby="new-password-hint"
            />
            <p id="new-password-hint" class="field-hint">Від 6 до 128 символів.</p>
          </div>
          <p class="muted account-dialog-description">
            Після зміни пароля всі сеанси завершаться. Потрібно буде увійти з новим паролем.
          </p>
        </template>
        <p v-else class="muted account-dialog-description">
          Для видалення акаунта та всіх його проєктів надішлемо посилання на {{ user?.email }}.
          Видалення відбудеться лише після підтвердження за посиланням. Відновлення неможливе.
        </p>
        <p v-if="fieldError" id="account-field-error" class="field-error" role="alert">
          {{ fieldError }}
        </p>
        <p v-if="mutationError" class="form-message form-error" role="alert">{{ mutationError }}</p>
        <div class="modal-actions">
          <button
            type="button"
            class="button button-secondary"
            :disabled="busy"
            :autofocus="dialog === 'delete'"
            @click="dismiss"
          >
            Скасувати
          </button>
          <button
            class="button"
            :class="dialog === 'delete' ? 'button-danger' : 'button-primary'"
            :disabled="busy"
          >
            {{
              busy
                ? 'Зачекайте…'
                : dialog === 'name'
                  ? 'Зберегти'
                  : dialog === 'password'
                    ? 'Змінити пароль'
                    : 'Надіслати посилання'
            }}
          </button>
        </div>
      </form>
    </ModalDialog>
  </section>
</template>
