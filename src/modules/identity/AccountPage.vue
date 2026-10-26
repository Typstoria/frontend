<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { identitySession } from './identity-session';
import { describeAuthError } from './auth-errors';
import GoogleSignInButton from './GoogleSignInButton.vue';

const { user } = identitySession;
const busy = ref(false);
const error = ref<ReturnType<typeof describeAuthError> | null>(null);
const linked = ref(false);
const controller = new AbortController();
const googleEnabled = Boolean(String(import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim());

async function run(action: () => Promise<void>) {
  busy.value = true;
  error.value = null;
  try {
    await action();
  } catch (cause) {
    if (!controller.signal.aborted) error.value = describeAuthError(cause);
  } finally {
    busy.value = false;
  }
}
function refresh() {
  return run(() => identitySession.refreshProfile(controller.signal));
}
function link(credential: string) {
  return run(async () => {
    await identitySession.linkGoogle(credential, controller.signal);
    linked.value = true;
  });
}
onMounted(refresh);
onBeforeUnmount(() => controller.abort());
</script>

<template>
  <section class="page account-page">
    <h1>Обліковий запис</h1>
    <div v-if="error" class="form-message form-error" role="alert">
      <p>{{ error.message }}</p>
    </div>
    <section class="panel account-card" :aria-busy="busy">
      <h2>Ваш профіль</h2>
      <p class="account-email">{{ user?.email }}</p>
      <p class="status-badge">Пошту підтверджено</p>
      <button class="button button-secondary" :disabled="busy" @click="refresh">
        Оновити профіль
      </button>
    </section>
    <section v-if="googleEnabled" class="panel account-card">
      <h2>Прив’язати Google</h2>
      <p class="muted">Оберіть Google-акаунт із тією самою електронною адресою.</p>
      <p v-if="linked" class="form-message form-success" role="status">Google-акаунт прив’язано.</p>
      <GoogleSignInButton v-else :disabled="busy" @credential="link" />
    </section>
  </section>
</template>
