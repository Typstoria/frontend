import { createRouter, createWebHistory } from 'vue-router';
import { nextTick } from 'vue';
import { SHARED_TEMPLATE_PATH, shareToken } from '../modules/templates/share-navigation';
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
      path: '/projects/:projectId([1-9][0-9]{0,9})/:workspaceView(history|proposals)?/:proposalId([1-9][0-9]{0,9})?',
      component: () => import('../modules/workspace/WorkspacePage.vue'),
      meta: { title: 'Редактор', requiresAuth: true, workspaceLayout: true },
    },
    {
      path: '/templates',
      component: () => import('../modules/templates/TemplatesPage.vue'),
      meta: { title: 'Шаблони', requiresAuth: true },
    },
    {
      path: SHARED_TEMPLATE_PATH,
      component: () => import('../modules/templates/TemplatesPage.vue'),
      meta: { title: 'Спільний шаблон' },
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
      path: '/auth/delete-account',
      component: () => import('../modules/identity/AccountDeletionPage.vue'),
      meta: { title: 'Видалення акаунта', authLayout: true },
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

let pendingShareFragment = '';

router.beforeEach((to, from) => {
  if (to.path === SHARED_TEMPLATE_PATH) {
    const fragment = pendingShareFragment;
    pendingShareFragment = '';
    if (!to.hash && fragment) return { path: to.path, hash: fragment, replace: true };
  } else if (
    to.meta.authLayout &&
    to.query.returnTo === SHARED_TEMPLATE_PATH &&
    from.path === SHARED_TEMPLATE_PATH &&
    shareToken(from.hash)
  ) {
    // Resume after sign-in without including the secret in the login URL or storing it on disk.
    pendingShareFragment = from.hash;
  } else if (!to.meta.authLayout) pendingShareFragment = '';
  if (to.params.proposalId && to.params.workspaceView !== 'proposals') return '/404';
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

router.afterEach(async (to, from) => {
  const titles: Record<string, string> = {
    login: 'Вхід',
    register: 'Реєстрація',
    'verify-email': 'Підтвердження пошти',
    'reset-password': 'Новий пароль',
    'forgot-password': 'Відновлення доступу',
  };
  const title =
    to.params.workspaceView === 'history'
      ? 'Історія версій'
      : to.params.workspaceView === 'proposals'
        ? 'ШІ-пропозиції'
        : to.meta.title;
  document.title = `${titles[String(to.params.flow)] ?? String(title ?? 'Документи')} · Typstoria`;
  if (
    to.meta.workspaceLayout &&
    from.meta.workspaceLayout &&
    to.params.projectId === from.params.projectId &&
    (to.params.workspaceView !== from.params.workspaceView ||
      to.params.proposalId !== from.params.proposalId)
  )
    return;
  await nextTick();
  document.getElementById('main-content')?.focus({ preventScroll: true });
});
