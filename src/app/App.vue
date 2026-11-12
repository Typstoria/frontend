<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import { identitySession } from '../modules/identity/identity-session';
import { disableGoogleAutoSelect } from '../modules/identity/google-identity';
import BrandLogo from '../shared/ui/BrandLogo.vue';

const route = useRoute();
const router = useRouter();
const { user } = identitySession;
const signingOut = ref(false);
let checkingSession = false;
const controller = new AbortController();
async function checkSession() {
  if (document.hidden || !user.value || checkingSession) return;
  if (!identitySession.isAuthenticated()) return;
  checkingSession = true;
  try {
    await identitySession.refreshProfile(controller.signal);
  } catch {
    /* A private auth failure ends the session; a network failure does not. */
  } finally {
    checkingSession = false;
  }
}
onMounted(() => {
  void checkSession();
  window.addEventListener('focus', checkSession);
  window.addEventListener('pageshow', checkSession);
  document.addEventListener('visibilitychange', checkSession);
});
onBeforeUnmount(() => {
  controller.abort();
  window.removeEventListener('focus', checkSession);
  window.removeEventListener('pageshow', checkSession);
  document.removeEventListener('visibilitychange', checkSession);
});
watch(user, (value) => {
  if (!value && route.meta.requiresAuth)
    void router.replace({
      path: '/auth/login',
      query: route.path === '/settings/account' ? { returnTo: route.path } : {},
    });
});
async function logout() {
  signingOut.value = true;
  disableGoogleAutoSelect();
  try {
    await identitySession.logout();
  } catch {
    /* The login page displays the server revocation warning. */
  } finally {
    signingOut.value = false;
    await router.replace('/auth/login');
  }
}
</script>

<template>
  <a class="skip-link" href="#main-content">Перейти до вмісту</a>
  <div class="app-shell" :class="{ 'auth-shell': route.meta.authLayout }">
    <header v-if="!route.meta.authLayout" class="app-header">
      <RouterLink to="/projects" class="brand" aria-label="Typstoria — проєкти">
        <BrandLogo />
      </RouterLink>
      <nav class="main-nav" aria-label="Головна навігація">
        <RouterLink to="/projects">Проєкти</RouterLink>
        <template v-if="route.path.startsWith('/preview/')">
          <RouterLink to="/preview/workspace">Редактор</RouterLink>
          <RouterLink to="/preview/review">ШІ-пропозиції</RouterLink>
        </template>
      </nav>
      <div v-if="user" class="account-actions">
        <RouterLink
          class="header-icon-button"
          to="/settings/account"
          aria-label="Обліковий запис"
          title="Обліковий запис"
        >
          <svg
            class="header-action-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="9" r="3" />
            <path d="M5.6 18.3a6.5 6.5 0 0 1 12.8 0" />
          </svg>
        </RouterLink>
        <button
          class="header-icon-button"
          aria-label="Вийти"
          title="Вийти"
          :disabled="signingOut"
          :aria-busy="signingOut"
          @click="logout"
        >
          <svg
            class="header-action-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M14 7l5 5-5 5M9 12h10" />
          </svg>
        </button>
      </div>
      <RouterLink v-else class="button button-secondary" to="/auth/login">Увійти</RouterLink>
    </header>
    <div v-if="route.path.startsWith('/preview/')" class="prototype-notice">
      Демонстраційний макет · дані документа не зберігаються
    </div>
    <main id="main-content" tabindex="-1">
      <RouterView
        :key="route.meta.requiresAuth ? `${route.path}:${user?.id ?? 'anonymous'}` : route.path"
      />
    </main>
  </div>
</template>
