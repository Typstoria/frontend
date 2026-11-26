<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { ApiError } from '../../shared/api/client';
import ModalDialog from '../../shared/ui/ModalDialog.vue';
import LoadError from '../../shared/ui/LoadError.vue';
import { identitySession } from '../identity/identity-session';
import { createProjectsApi, titleError } from './projects-api';
import type { Project } from './projects-api';
import DocumentCover from '../../shared/ui/DocumentCover.vue';
import './projects.css';

const ImportZipDialog = defineAsyncComponent(() => import('../templates/ImportZipDialog.vue'));
const importOpen = ref(false);
const importOpened = ref(false);

type Dialog = { kind: 'create' } | { kind: 'rename' | 'delete'; project: Project };
const api = createProjectsApi(identitySession.request);
const controller = new AbortController();
const projects = ref<Project[]>([]);
const searchInput = ref('');
const appliedSearch = ref('');
const nextCursor = ref<number | null>(null);
const loaded = ref(false);
const loading = ref<'reset' | 'more' | null>(null);
const searchDebouncing = ref(false);
const skeletonReady = ref(false);
const listError = ref('');
const notice = ref('');
const activeActions = ref<number | null>(null);
const actionMenuLeft = ref(false);
const dialog = ref<Dialog | null>(null);
const dialogOpen = ref(false);
const dialogTrigger = ref<HTMLElement | null>(null);
const title = ref('');
const fieldError = ref('');
const mutationError = ref('');
const busy = ref(false);
const unavailable = ref(false);
const failedLoad = ref<'reset' | 'more'>('reset');
let listController: AbortController | null = null;
let listGeneration = 0;
let searchTimer: ReturnType<typeof setTimeout> | undefined;
let skeletonTimer: ReturnType<typeof setTimeout> | undefined;
let refreshAfterDialog = false;
let pendingSearchReload = false;
// Keep the key across explicit retries and closing/reopening a failed create dialog.
// It stays in this page's memory, alongside the current session, never browser storage.
let createAttempt: { title: string; key: string } | null = null;

const dialogTitle = computed(() => {
  if (dialog.value?.kind === 'create') return 'Новий проєкт';
  return dialog.value?.kind === 'rename' ? 'Перейменувати проєкт' : 'Видалити проєкт?';
});
const showGridSkeleton = computed(
  () => skeletonReady.value && loading.value === 'reset' && projects.value.length === 0,
);
function clearSkeleton() {
  clearTimeout(skeletonTimer);
  skeletonTimer = undefined;
  skeletonReady.value = false;
}
const dateFormat = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'medium', timeStyle: 'short' });

async function load(kind: 'reset' | 'more' = 'reset', search = appliedSearch.value) {
  if (loading.value || dialog.value) return;
  if (kind === 'more' && nextCursor.value === null) return;
  const generation = ++listGeneration;
  const requestController = new AbortController();
  listController = requestController;
  loading.value = kind;
  clearSkeleton();
  if (kind === 'reset' && projects.value.length === 0) {
    skeletonTimer = setTimeout(() => {
      if (generation === listGeneration && loading.value === 'reset') skeletonReady.value = true;
    }, 200);
  }
  listError.value = '';
  activeActions.value = null;
  try {
    const page = await api.list(
      kind === 'more' ? nextCursor.value! : undefined,
      requestController.signal,
      search,
    );
    if (generation !== listGeneration) return;
    requestController.signal.throwIfAborted();
    projects.value = kind === 'reset' ? page.items : [...projects.value, ...page.items];
    nextCursor.value = page.nextCursor;
    loaded.value = true;
  } catch (error) {
    if (requestController.signal.aborted || generation !== listGeneration) return;
    failedLoad.value = kind;
    listError.value =
      error instanceof ApiError && error.status === 429
        ? 'Забагато запитів. Спробуйте трохи пізніше.'
        : 'Перевірте з’єднання й повторіть спробу.';
  } finally {
    if (generation === listGeneration) {
      clearSkeleton();
      loading.value = null;
      listController = null;
    }
  }
}

function searchChanged() {
  const nextSearch = searchInput.value.trim();
  if (nextSearch === appliedSearch.value) return;
  if (searchTimer) clearTimeout(searchTimer);
  listController?.abort();
  listController = null;
  listGeneration++;
  loading.value = null;
  clearSkeleton();
  // Retain the previous result until the replacement response is ready.
  // Its cursor cannot be reused with a different query.
  nextCursor.value = null;
  searchDebouncing.value = true;
  listError.value = '';
  activeActions.value = null;
  appliedSearch.value = nextSearch;
  searchTimer = setTimeout(() => {
    searchTimer = undefined;
    searchDebouncing.value = false;
    if (dialog.value) pendingSearchReload = true;
    else void load('reset', nextSearch);
  }, 300);
}

async function toggleActions(projectId: number) {
  if (activeActions.value === projectId) {
    escapeActions();
    return;
  }
  activeActions.value = projectId;
  await nextTick();
  const button = document.getElementById(`project-action-button-${projectId}`);
  const card = button?.closest('.project-card');
  actionMenuLeft.value = card ? card.getBoundingClientRect().right - 190 < 8 : false;
  document.getElementById(`project-actions-${projectId}`)?.querySelector('button')?.focus();
}
function closeActions(event: PointerEvent) {
  if (!(event.target instanceof Element) || !event.target.closest('.project-actions'))
    activeActions.value = null;
}
function leaveActions(event: FocusEvent) {
  if (
    !(event.currentTarget instanceof Element) ||
    !(event.relatedTarget instanceof Node) ||
    !event.currentTarget.contains(event.relatedTarget)
  )
    activeActions.value = null;
}
function escapeActions() {
  if (activeActions.value !== null)
    document.getElementById(`project-action-button-${activeActions.value}`)?.focus();
  activeActions.value = null;
}
function openDialog(value: Dialog) {
  if (loading.value) return;
  dialogTrigger.value = document.getElementById(
    value.kind === 'create' ? 'new-project' : `project-action-button-${value.project.id}`,
  );
  activeActions.value = null;
  fieldError.value = '';
  mutationError.value = '';
  unavailable.value = false;
  notice.value = '';
  title.value = value.kind === 'create' ? (createAttempt?.title ?? '') : value.project.title;
  dialog.value = value;
  dialogOpen.value = true;
}
function dismiss() {
  if (!busy.value) dialogOpen.value = false;
}
async function closed() {
  const current = dialog.value;
  dialog.value = null;
  await nextTick();
  if (
    current?.kind !== 'create' &&
    current &&
    !projects.value.some((project) => project.id === current.project.id)
  )
    document.getElementById('new-project')?.focus();
  if (refreshAfterDialog || pendingSearchReload) {
    refreshAfterDialog = false;
    pendingSearchReload = false;
    void load('reset');
  }
}

async function submit() {
  const current = dialog.value;
  if (!current || busy.value || unavailable.value) return;
  fieldError.value = current.kind === 'delete' ? '' : titleError(title.value);
  mutationError.value = '';
  if (fieldError.value) {
    document.getElementById('project-title')?.focus();
    return;
  }
  busy.value = true;
  try {
    if (current.kind === 'create') {
      const trimmed = title.value.trim();
      if (createAttempt?.title !== trimmed)
        createAttempt = { title: trimmed, key: crypto.randomUUID() };
      const created = await api.create(trimmed, createAttempt!.key, controller.signal);
      // Create returns revision metadata, so fetch the canonical title and timestamps.
      const project = await api.get(created.projectId, controller.signal);
      controller.signal.throwIfAborted();
      projects.value = [project, ...projects.value.filter((item) => item.id !== project.id)].sort(
        (a, b) => b.id - a.id,
      );
      createAttempt = null;
      refreshAfterDialog = appliedSearch.value !== '';
      notice.value = 'Проєкт створено.';
    } else if (current.kind === 'rename') {
      const project = await api.rename(current.project.id, title.value, controller.signal);
      controller.signal.throwIfAborted();
      projects.value = projects.value.map((item) => (item.id === project.id ? project : item));
      refreshAfterDialog = appliedSearch.value !== '';
      notice.value = 'Назву збережено.';
    } else {
      try {
        await api.remove(current.project.id, controller.signal);
      } catch (error) {
        // Another tab may already have removed it; the requested outcome is reached.
        if (!(error instanceof ApiError && error.status === 404)) throw error;
      }
      controller.signal.throwIfAborted();
      projects.value = projects.value.filter((item) => item.id !== current.project.id);
      refreshAfterDialog = appliedSearch.value !== '';
      notice.value = 'Проєкт видалено.';
    }
    busy.value = false;
    await dismiss();
  } catch (error) {
    if (controller.signal.aborted) return;
    if (error instanceof ApiError && error.status === 404) {
      if (current.kind === 'create') {
        createAttempt = null;
        mutationError.value = 'Створений проєкт уже видалено. Спробуйте створити новий.';
      } else {
        projects.value = projects.value.filter((item) => item.id !== current.project.id);
        unavailable.value = true;
        mutationError.value = 'Проєкт більше недоступний.';
      }
    } else if (error instanceof ApiError && error.status === 400 && current.kind !== 'delete') {
      fieldError.value = 'Перевірте назву: від 1 до 200 символів без керівних символів.';
    } else if (error instanceof ApiError && error.status === 429) {
      mutationError.value = 'Забагато запитів. Спробуйте трохи пізніше.';
    } else {
      mutationError.value =
        current.kind === 'create'
          ? 'Не вдалося підтвердити створення. Перевірте підключення та повторіть спробу з тією самою назвою.'
          : current.kind === 'rename'
            ? 'Не вдалося зберегти назву. Перевірте підключення та повторіть спробу.'
            : 'Не вдалося підтвердити видалення. Перевірте підключення та повторіть спробу.';
    }
  } finally {
    busy.value = false;
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', closeActions);
  void load();
});
onBeforeUnmount(() => {
  controller.abort();
  listController?.abort();
  if (searchTimer) clearTimeout(searchTimer);
  clearSkeleton();
  createAttempt = null;
  document.removeEventListener('pointerdown', closeActions);
});
</script>

<template>
  <section class="page projects-page" aria-labelledby="projects-title">
    <div class="page-heading projects-heading">
      <h1 id="projects-title">Ваші проєкти</h1>
      <div class="projects-toolbar-actions">
        <div class="projects-search">
          <svg aria-hidden="true" viewBox="0 0 20 20" focusable="false">
            <circle cx="8.7" cy="8.7" r="5.5" />
            <path d="m13 13 4 4" />
          </svg>
          <input
            id="projects-search"
            v-model="searchInput"
            type="search"
            maxlength="200"
            autocomplete="off"
            placeholder="Пошук проєктів"
            aria-label="Пошук проєктів"
            :disabled="dialogOpen"
            @input="searchChanged"
          />
        </div>
        <button
          class="button button-secondary projects-import"
          @click="
            importOpened = true;
            importOpen = true;
          "
        >
          Імпорт ZIP
        </button>
        <button
          id="new-project"
          class="button button-primary projects-create"
          :disabled="!!loading"
          @click="openDialog({ kind: 'create' })"
        >
          <span aria-hidden="true">+</span> Новий проєкт
        </button>
      </div>
    </div>

    <p v-if="notice" class="projects-notice" role="status">{{ notice }}</p>
    <p
      v-if="loading === 'reset'"
      class="projects-loading projects-loading-visually-hidden"
      role="status"
    >
      Завантаження проєктів…
    </p>
    <LoadError
      v-if="listError"
      class="projects-error"
      :title="
        failedLoad === 'more'
          ? 'Не вдалося завантажити наступні проєкти'
          : 'Не вдалося завантажити проєкти'
      "
      :message="listError"
      retry-label="Повторити"
      :retrying="!!loading"
      @retry="load(failedLoad)"
    />

    <ul v-if="projects.length" class="project-list" aria-label="Проєкти" :aria-busy="!!loading">
      <li v-for="project in projects" :key="project.id" class="project-card">
        <RouterLink
          class="project-info"
          :to="`/projects/${project.id}`"
          :aria-label="project.title"
          :aria-describedby="`project-updated-${project.id}`"
        >
          <DocumentCover
            :key="`${project.id}:${project.preview?.version ?? 'blank'}`"
            class="project-preview"
            :load="
              project.preview
                ? (signal) => api.preview(project.id, project.preview!.version, signal)
                : undefined
            "
          />
          <h2>
            {{ project.title }}
          </h2>
          <p :id="`project-updated-${project.id}`">
            Оновлено
            <time :datetime="project.updatedAt">{{
              dateFormat.format(new Date(project.updatedAt))
            }}</time>
          </p>
        </RouterLink>
        <div
          class="project-actions"
          @mousedown.left.prevent
          @focusout="leaveActions"
          @keydown.esc.stop.prevent="escapeActions"
        >
          <button
            :id="`project-action-button-${project.id}`"
            class="button project-action-button"
            :aria-label="`Дії: ${project.title}`"
            :aria-expanded="activeActions === project.id"
            :aria-controls="
              activeActions === project.id ? `project-actions-${project.id}` : undefined
            "
            :disabled="!!loading"
            @click="toggleActions(project.id)"
          >
            <span aria-hidden="true">•••</span>
          </button>
          <div
            v-if="activeActions === project.id"
            :id="`project-actions-${project.id}`"
            class="project-action-list"
            :class="{ 'project-action-list-left': actionMenuLeft }"
            role="group"
            :aria-label="`Дії: ${project.title}`"
          >
            <button @click="openDialog({ kind: 'rename', project })">Перейменувати</button>
            <button class="danger-text" @click="openDialog({ kind: 'delete', project })">
              Видалити
            </button>
          </div>
        </div>
      </li>
    </ul>
    <ul v-else-if="showGridSkeleton" class="project-list project-skeleton-list" aria-hidden="true">
      <li v-for="index in 8" :key="index" class="project-card project-card-skeleton">
        <div class="project-info">
          <div class="project-preview project-skeleton-preview">
            <span class="project-skeleton-shimmer"></span>
          </div>
          <div class="project-skeleton-title project-skeleton-shimmer"></div>
          <div class="project-skeleton-date project-skeleton-shimmer"></div>
        </div>
      </li>
    </ul>
    <div
      v-else-if="loaded && !loading && !searchDebouncing && !listError"
      class="empty-state panel projects-empty"
    >
      <p>{{ appliedSearch ? 'Проєктів не знайдено' : 'Проєктів ще немає' }}</p>
    </div>
    <div v-if="nextCursor !== null" class="projects-pagination">
      <button class="button button-secondary" :disabled="!!loading" @click="load('more')">
        {{ loading === 'more' ? 'Завантаження…' : 'Завантажити ще' }}
      </button>
    </div>

    <ImportZipDialog v-if="importOpened" :open="importOpen" @dismiss="importOpen = false" />
    <ModalDialog
      :open="dialogOpen"
      :title="dialogTitle"
      :busy="busy"
      :return-focus="dialogTrigger"
      @dismiss="dismiss"
      @closed="closed"
    >
      <form v-if="dialog" novalidate @submit.prevent="submit">
        <template v-if="dialog.kind === 'delete'">
          <p class="delete-project-name">{{ dialog.project.title }}</p>
          <p id="delete-warning" class="muted">
            Проєкт і його файли стануть недоступними. Скасувати видалення в застосунку неможливо.
          </p>
        </template>
        <div v-else class="form-field">
          <label for="project-title">Назва</label>
          <input
            id="project-title"
            v-model="title"
            autofocus
            autocomplete="off"
            :disabled="busy || unavailable"
            :aria-invalid="!!fieldError"
            :aria-describedby="fieldError ? 'title-error' : undefined"
            @input="fieldError = ''"
          />
          <p v-if="fieldError" id="title-error" class="field-error" role="alert">
            {{ fieldError }}
          </p>
        </div>
        <p v-if="mutationError" class="form-message form-error" role="alert">{{ mutationError }}</p>
        <div class="modal-actions">
          <button
            type="button"
            class="button button-secondary"
            :disabled="busy"
            :autofocus="dialog.kind === 'delete'"
            @click="dismiss"
          >
            {{ unavailable ? 'Закрити' : 'Скасувати' }}
          </button>
          <button
            v-if="!unavailable"
            type="submit"
            class="button"
            :class="dialog.kind === 'delete' ? 'button-danger' : 'button-primary'"
            :disabled="busy"
            :aria-describedby="dialog.kind === 'delete' ? 'delete-warning' : undefined"
          >
            {{
              busy
                ? 'Зачекайте…'
                : dialog.kind === 'create'
                  ? 'Створити'
                  : dialog.kind === 'rename'
                    ? 'Зберегти'
                    : 'Видалити'
            }}
          </button>
        </div>
      </form>
    </ModalDialog>
  </section>
</template>
