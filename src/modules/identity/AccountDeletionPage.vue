<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { RouterLink, onBeforeRouteUpdate } from 'vue-router';
import BrandLogo from '../../shared/ui/BrandLogo.vue';
import { identitySession } from './identity-session';
import { consumeChallenge, takeEmailChallenge } from './email-challenge';
import { describeAuthError } from './auth-errors';

let token = consumeChallenge('/auth/delete-account');
const valid = ref(Boolean(token));
const confirmed = ref(false);
const busy = ref(false);
const done = ref(false);
const error = ref('');
const controller = new AbortController();
// A second email link can open in the same document; scrub it before accepting navigation.
onBeforeRouteUpdate((to) => {
  if (!to.hash) return;
  const nextToken = takeEmailChallenge(
    { hash: to.hash, pathname: to.path, search: '' },
    window.history,
  );
  if (!busy.value) {
    token = nextToken;
    valid.value = Boolean(token);
    confirmed.value = false;
    done.value = false;
    error.value = '';
  }
  return { path: to.path, replace: true };
});
async function remove() {
  if (!token || !confirmed.value || busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    await identitySession.api.deleteAccount(token, controller.signal);
    if (!controller.signal.aborted) {
      token = null;
      done.value = true;
      identitySession.invalidate();
    }
  } catch (cause) {
    if (!controller.signal.aborted) {
      const failure = describeAuthError(cause);
      error.value =
        failure.code === 'INVALID_OR_EXPIRED_TOKEN'
          ? 'Посилання недійсне, прострочене або вже використане. Якщо акаунт ще доступний, запросіть нове в його налаштуваннях.'
          : failure.message;
      if (failure.code === 'INVALID_OR_EXPIRED_TOKEN') {
        token = null;
        valid.value = false;
      }
    }
  } finally {
    busy.value = false;
  }
}
onBeforeUnmount(() => {
  controller.abort();
  token = null;
});
</script>

<template>
  <div class="auth-screen">
    <header class="auth-header">
      <RouterLink to="/projects" aria-label="Typstoria — проєкти"><BrandLogo /></RouterLink>
    </header>
    <div class="auth-stage">
      <h1>Видалення акаунта</h1>
      <div class="auth-card">
        <template v-if="done">
          <p role="status">Акаунт і його проєкти видалено.</p>
          <RouterLink class="button button-secondary" to="/auth/login">Перейти до входу</RouterLink>
        </template>
        <form v-else-if="valid" :aria-busy="busy" @submit.prevent="remove">
          <p>Обліковий запис і всі його проєкти буде видалено. Відновлення неможливе.</p>
          <p v-if="error" class="form-message form-error" role="alert">{{ error }}</p>
          <label class="account-delete-confirm"
            ><input v-model="confirmed" type="checkbox" :disabled="busy" />Я підтверджую видалення
            акаунта та всіх його проєктів.</label
          >
          <button class="button button-danger auth-submit" :disabled="busy || !confirmed">
            {{ busy ? 'Видалення…' : 'Видалити акаунт назавжди' }}
          </button>
          <RouterLink v-if="!busy" class="text-link account-delete-return" to="/projects"
            >Скасувати</RouterLink
          >
        </form>
        <template v-else>
          <p role="alert">
            {{ error || 'Посилання недійсне. Запросіть нове в налаштуваннях облікового запису.' }}
          </p>
          <RouterLink class="button button-secondary" to="/settings/account"
            >До облікового запису</RouterLink
          >
        </template>
      </div>
    </div>
  </div>
</template>
