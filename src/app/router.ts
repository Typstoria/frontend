import { createRouter, createWebHistory } from 'vue-router';

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/projects' },
    {
      path: '/projects',
      component: () => import('../modules/projects/ProjectsPage.vue'),
      meta: { title: 'Проєкти' },
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
      component: () => import('../modules/identity/AuthPlaceholderPage.vue'),
      meta: { title: 'Обліковий запис' },
    },
    {
      path: '/:pathMatch(.*)*',
      component: () => import('./NotFoundPage.vue'),
      meta: { title: 'Сторінку не знайдено' },
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
});

router.afterEach((to) => {
  document.title = `${String(to.meta.title ?? 'Документи')} · Typstoria`;
  // Fragment tokens must never be sent automatically by a route lifecycle hook.
  document.getElementById('main-content')?.focus();
});
