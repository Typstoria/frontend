<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import BrandLogo from '../../shared/ui/BrandLogo.vue';
import { identitySession } from './identity-session';
import { describeAuthError } from './auth-errors';
import { safeReturnTo, consumeChallenge } from './email-challenge';
import GoogleSignInButton from './GoogleSignInButton.vue';
import PasswordField from './PasswordField.vue';

const route = useRoute();
const router = useRouter();
const flow = String(route.params.flow);
const content: Record<string, { title: string; action: string }> = {
  login: {
    title: 'Увійти в Typstoria',
    action: 'Увійти',
  },
  register: {
    title: 'Створити акаунт',
    action: 'Зареєструватися',
  },
  'forgot-password': {
    title: 'Відновити доступ',
    action: 'Надіслати посилання',
  },
  'verify-email': {
    title: 'Підтвердити пошту',
    action: 'Підтвердити пошту',
  },
  'reset-password': {
    title: 'Новий пароль',
    action: 'Зберегти пароль',
  },
};
const copy = content[flow] ?? content.login!;
const email = ref('');
const password = ref('');
const busy = ref(false);
const done = ref(false);
const resendMode = ref(false);
const error = ref<ReturnType<typeof describeAuthError> | null>(null);
const status = ref('');
const cooldown = ref(0);
let emailToken = consumeChallenge(route.path);
const needsLink = ref((flow === 'verify-email' || flow === 'reset-password') && !emailToken);
const showEmail = computed(
  () =>
    flow === 'login' ||
    flow === 'register' ||
    flow === 'forgot-password' ||
    resendMode.value ||
    needsLink.value,
);
const showPassword = flow === 'login' || flow === 'register' || flow === 'reset-password';
const isEmailRequest = computed(
  () => flow === 'forgot-password' || flow === 'register' || resendMode.value || needsLink.value,
);
const returnTo = safeReturnTo(route.query.returnTo);
const googleEnabled = Boolean(String(import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim());
const controller = new AbortController();
let cooldownTimer: ReturnType<typeof setInterval> | undefined;
let alive = true;
const links = computed(() => ({ query: returnTo === '/projects' ? {} : { returnTo } }));
const passwordDescription = computed(() =>
  [flow !== 'login' ? 'password-hint' : null, error.value ? 'auth-error' : null]
    .filter(Boolean)
    .join(' '),
);

function startCooldown() {
  if (cooldownTimer) clearInterval(cooldownTimer);
  const until = Date.now() + 300_000;
  cooldown.value = 300;
  cooldownTimer = setInterval(() => {
    cooldown.value = Math.max(0, Math.ceil((until - Date.now()) / 1000));
    if (cooldown.value === 0) clearInterval(cooldownTimer);
  }, 1000);
}

async function run(action: () => Promise<void>) {
  if (busy.value) return;
  busy.value = true;
  error.value = null;
  status.value = '';
  try {
    await action();
  } catch (cause) {
    if (alive && !controller.signal.aborted) {
      error.value = describeAuthError(cause);
      if (error.value.code === 'INVALID_OR_EXPIRED_TOKEN') {
        emailToken = null;
        needsLink.value = true;
      }
    }
  } finally {
    password.value = '';
    if (alive) busy.value = false;
  }
}

async function submit() {
  if (cooldown.value && isEmailRequest.value) return;
  await run(async () => {
    const signal = controller.signal;
    if (resendMode.value || (needsLink.value && flow === 'verify-email')) {
      await identitySession.api.resend(email.value.trim(), signal);
      status.value =
        'Якщо адреса потребує підтвердження, ми надішлемо лист. Перевірте також папку «Спам». Новий запит — через 5 хвилин.';
      startCooldown();
    } else if (flow === 'forgot-password' || (needsLink.value && flow === 'reset-password')) {
      await identitySession.api.forgot(email.value.trim(), signal);
      status.value =
        'Якщо для цієї адреси доступне відновлення пароля, ми надішлемо лист. Для акаунта Google скористайтеся входом через Google.';
      startCooldown();
    } else if (flow === 'login') {
      await identitySession.login({ email: email.value.trim(), password: password.value }, signal);
      await router.replace(returnTo);
    } else if (flow === 'register') {
      await identitySession.api.register(
        { email: email.value.trim(), password: password.value },
        signal,
      );
      resendMode.value = true;
      status.value =
        'Якщо адреса доступна для реєстрації, ми надішлемо лист підтвердження. Після підтвердження увійдіть до акаунта.';
      startCooldown();
    } else if (flow === 'verify-email') {
      await identitySession.api.verify(emailToken!, signal);
      identitySession.invalidate();
      emailToken = null;
      done.value = true;
    } else if (flow === 'reset-password') {
      await identitySession.api.reset(emailToken!, password.value, signal);
      identitySession.invalidate();
      emailToken = null;
      done.value = true;
    }
  });
}

async function googleSignIn(credential: string) {
  await run(async () => {
    await identitySession.google(credential, controller.signal);
    await router.replace(returnTo);
  });
}

function resend() {
  resendMode.value = true;
  error.value = null;
  status.value = '';
}

function returnToLogin() {
  resendMode.value = false;
  error.value = null;
  status.value = '';
}

onBeforeUnmount(() => {
  alive = false;
  controller.abort();
  emailToken = null;
  password.value = '';
  if (cooldownTimer) clearInterval(cooldownTimer);
});
</script>

<template>
  <div class="auth-screen">
    <header class="auth-header">
      <RouterLink to="/auth/login" aria-label="Typstoria — вхід"><BrandLogo /></RouterLink>
    </header>
    <div class="auth-stage">
      <section class="auth-content">
        <div class="auth-heading">
          <h1>{{ copy.title }}</h1>
        </div>
        <div v-if="done" class="auth-card auth-complete" role="status">
          <h2>{{ flow === 'verify-email' ? 'Пошту підтверджено' : 'Пароль змінено' }}</h2>
          <p class="muted">Тепер увійдіть до акаунта, щоб продовжити роботу.</p>
          <RouterLink :to="{ path: '/auth/login', ...links }" class="button button-primary"
            >Перейти до входу</RouterLink
          >
        </div>
        <form v-else class="auth-card" :aria-busy="busy" @submit.prevent="submit">
          <div v-if="needsLink && !status" class="auth-callout">
            Посилання недійсне. Вкажіть пошту, щоб отримати нове.
          </div>
          <div
            v-if="flow === 'login' && identitySession.endReason.value && !error"
            class="auth-callout"
            role="status"
          >
            Сеанс завершено. Увійдіть, щоб продовжити.
          </div>
          <div
            v-if="identitySession.logoutFailed.value"
            class="form-message form-error"
            role="alert"
          >
            Не вдалося підтвердити вихід. Перевірте підключення.
          </div>
          <div v-if="error" id="auth-error" class="form-message form-error" role="alert">
            <p>{{ error.message }}</p>
            <button
              v-if="error.code === 'EMAIL_NOT_VERIFIED'"
              type="button"
              class="text-button"
              @click="resend"
            >
              Надіслати лист підтвердження
            </button>
          </div>
          <div v-if="status" class="form-message form-success" role="status">{{ status }}</div>
          <fieldset :disabled="busy" class="auth-fieldset">
            <div v-if="showEmail" class="form-field">
              <label for="email">Електронна пошта</label>
              <input
                id="email"
                v-model="email"
                type="email"
                autocomplete="email"
                inputmode="email"
                maxlength="254"
                placeholder="name@example.com"
                required
                :aria-invalid="error?.code === 'INVALID_CREDENTIALS' || undefined"
                :aria-describedby="error ? 'auth-error' : undefined"
              />
            </div>
            <div v-if="showPassword && !resendMode && !needsLink" class="form-field">
              <label for="password">{{
                flow === 'reset-password' ? 'Новий пароль' : 'Пароль'
              }}</label>
              <PasswordField
                id="password"
                v-model="password"
                :autocomplete="flow === 'login' ? 'current-password' : 'new-password'"
                :min-length="flow === 'login' ? 1 : 6"
                :describedby="passwordDescription"
                :invalid="error?.code === 'INVALID_CREDENTIALS'"
              />
              <p v-if="flow !== 'login'" id="password-hint" class="field-hint">
                Від 6 до 128 символів.
              </p>
            </div>
            <div v-if="flow === 'login' && !resendMode" class="form-link-row">
              <RouterLink to="/auth/forgot-password" class="text-link">Забули пароль?</RouterLink>
            </div>
            <p v-if="flow === 'verify-email' && !needsLink && !resendMode" class="muted">
              Натисніть кнопку нижче, щоб підтвердити вашу електронну адресу.
            </p>
            <button
              type="submit"
              class="button button-primary auth-submit"
              :disabled="busy || (cooldown > 0 && isEmailRequest)"
            >
              {{
                busy
                  ? 'Зачекайте…'
                  : resendMode || needsLink
                    ? 'Надіслати нове посилання'
                    : copy.action
              }}
            </button>
            <p v-if="cooldown > 0 && isEmailRequest" class="field-hint" role="status">
              Повторний запит через {{ Math.floor(cooldown / 60) }}:{{
                String(cooldown % 60).padStart(2, '0')
              }}.
            </p>
          </fieldset>
          <button
            v-if="flow === 'login' && resendMode"
            type="button"
            class="text-button auth-return"
            :disabled="busy"
            @click="returnToLogin"
          >
            Повернутися до входу
          </button>
          <template
            v-if="googleEnabled && (flow === 'login' || flow === 'register') && !resendMode"
          >
            <div class="form-divider"><span>або</span></div>
            <GoogleSignInButton :disabled="busy" @credential="googleSignIn" />
          </template>
          <p class="auth-switch">
            <template v-if="flow === 'login'"
              >Немає акаунта?
              <RouterLink :to="{ path: '/auth/register', ...links }" class="text-link"
                >Зареєструватися</RouterLink
              ></template
            >
            <template v-else
              >Вже є акаунт?
              <RouterLink :to="{ path: '/auth/login', ...links }" class="text-link"
                >Увійти</RouterLink
              ></template
            >
          </p>
        </form>
      </section>
    </div>
  </div>
</template>
