import { createRouter, createWebHistory } from 'vue-router';
import { nextTick } from 'vue';
import { identitySession } from '../modules/identity/identity-session';
import { captureInitialChallenge, safeReturnTo } from '../modules/identity/email-challenge';

// Remove email credentials before Router observes the initial URL/history entry.
captureInitialChallenge();

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/projects' },
    {
      path: '/projects',
      component: () => import('../modules/projects/ProjectsPage.vue'),
      meta: { title: 'Проєкти', requiresAuth: true },
    },
    {
      path: '/settings/account',
      component: () => import('../modules/identity/AccountPage.vue'),
      meta: { title: 'Обліковий запис', requiresAuth: true },
    },
    {
      path: '/preview/workspace',
      component: () => import('../modules/workspace/WorkspacePreviewPage.vue'),
      meta: { title: 'Макет редактора' },
    },
    {
      path: '/preview/review',
      component: () => import('../modules/review/ReviewPreviewPage.vue'),
      meta: { title: 'Макет ШІ-пропозиції' },
    },
    {
      path: '/auth/:flow(login|register|verify-email|forgot-password|reset-password)',
      component: () => import('../modules/identity/AuthPage.vue'),
      meta: { title: 'Обліковий запис', authLayout: true },
    },
    {
      path: '/:pathMatch(.*)*',
      component: () => import('./NotFoundPage.vue'),
      meta: { title: 'Сторінку не знайдено' },
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach((to) => {
  const authenticated = identitySession.isAuthenticated();
  if (to.meta.requiresAuth && !authenticated) {
    const returnTo = safeReturnTo(to.path);
    return { path: '/auth/login', query: returnTo === '/projects' ? {} : { returnTo } };
  }
  if (
    to.meta.authLayout &&
    ['login', 'register'].includes(String(to.params.flow)) &&
    authenticated
  ) {
    return safeReturnTo(to.query.returnTo);
  }
});

router.afterEach(async (to) => {
  const titles: Record<string, string> = {
    login: 'Вхід',
    register: 'Реєстрація',
    'verify-email': 'Підтвердження пошти',
    'reset-password': 'Новий пароль',
    'forgot-password': 'Відновлення доступу',
  };
  document.title = `${titles[String(to.params.flow)] ?? String(to.meta.title ?? 'Документи')} · Typstoria`;
  await nextTick();
  document.getElementById('main-content')?.focus({ preventScroll: true });
});
