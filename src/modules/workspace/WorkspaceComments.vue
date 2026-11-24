<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import ModalDialog from '../../shared/ui/ModalDialog.vue';
import { identitySession } from '../identity/identity-session';
import { ApiError } from '../../shared/api/client';
import { createAnnotationsApi, type Annotation, type TextAnchor } from './annotation-api';
import { createWorkspaceApi, type Changes } from './workspace-api';
import { workspaceError } from './workspace-model';
import type { CommentLayout } from './comment-layout';

const props = defineProps<{
  open: boolean;
  projectId: number;
  revisionId: number;
  files: { fileId: number; path: string }[];
  dirtyFileIds: number[];
  layout: CommentLayout | null;
  compact: boolean;
  selection: TextAnchor | null;
  locked: boolean;
  prepare: (anchor: TextAnchor) => Promise<number | null>;
}>();
const emit = defineEmits<{
  dismiss: [];
  list: [items: Annotation[]];
  reveal: [item: Annotation];
  dirty: [value: boolean];
  highlight: [id: number];
}>();

const api = createAnnotationsApi(props.projectId, identitySession.request);
const workspace = createWorkspaceApi(identitySession.request);
const lifetime = new AbortController();
const items = shallowRef<Annotation[]>([]);
const pageSize = 100;
const visibleCount = ref(pageSize);
const reading = ref(false);
const listError = ref('');
const error = ref('');
const filter = ref<'all' | 'active' | 'resolved'>('active');
const busy = ref(false);
const editing = shallowRef<{ item: Annotation | null; anchor: TextAnchor | null } | null>(null);
const body = ref('');
const input = ref<HTMLTextAreaElement | null>(null);
const panel = ref<HTMLElement | null>(null);
const list = ref<HTMLOListElement | null>(null);
const removeTarget = shallowRef<Annotation | null>(null);
const discard = ref<'editor' | 'panel' | null>(null);
const attempt = shallowRef<{ body: Changes; key: string } | null>(null);
const chosen = ref<number | null>(null);
let readController: AbortController | undefined;
let cardObserver: ResizeObserver | undefined;
const metrics = shallowRef({ listTop: 0, panelTop: 0, heights: {} as Record<number, number> });
const date = new Intl.DateTimeFormat('uk', { dateStyle: 'short', timeStyle: 'short' });

const heading = computed(() => (editing.value?.item ? 'Редагувати коментар' : 'Новий коментар'));
const bodyTooLong = computed(
  () => body.value.length > 5000 && Array.from(body.value.trim()).length > 5000,
);
const filtered = computed(() =>
  items.value.filter((item) => filter.value === 'all' || item.status === filter.value),
);
const dirty = computed(
  () =>
    !!attempt.value || (editing.value !== null && body.value !== (editing.value.item?.body ?? '')),
);
const paths = computed(() => new Map(props.files.map((file) => [file.fileId, file.path])));
const orderedCards = computed(() => {
  const positions = props.layout?.positions;
  if (!positions) return filtered.value;
  return [...filtered.value].sort((a, b) => {
    const left = positions[a.id] ?? Number.MAX_SAFE_INTEGER;
    const right = positions[b.id] ?? Number.MAX_SAFE_INTEGER;
    return left - right;
  });
});
const cards = computed(() => orderedCards.value.slice(0, visibleCount.value));
const cardIds = computed(() => cards.value.map(({ id }) => id).join(','));
const topAdjust = computed(() =>
  props.layout ? props.layout.viewportTop - metrics.value.panelTop - metrics.value.listTop : 0,
);
const cardGaps = computed(() => {
  const positions = props.layout?.positions;
  if (!positions) return {};
  let occupied = 0;
  const gaps: Record<number, number> = {};
  for (const { id } of cards.value) {
    const top = positions[id];
    const margin = top === undefined ? 0 : Math.max(0, top + topAdjust.value - occupied);
    gaps[id] = margin;
    occupied += margin + (metrics.value.heights[id] ?? 0) + 8;
  }
  return gaps;
});

function measureCards() {
  if (!list.value || !panel.value) return;
  const panelTop = panel.value.getBoundingClientRect().top;
  metrics.value = {
    panelTop,
    listTop: list.value.getBoundingClientRect().top - panelTop + panel.value.scrollTop,
    heights: Object.fromEntries(
      Array.from(list.value.children, (card) => [
        (card as HTMLElement).dataset.commentCard,
        (card as HTMLElement).offsetHeight,
      ]),
    ),
  };
}

watch(
  [list, cardIds],
  () => {
    cardObserver?.disconnect();
    if (!list.value || !panel.value) return;
    cardObserver = new ResizeObserver(measureCards);
    cardObserver.observe(panel.value);
    cardObserver.observe(list.value);
    for (const card of list.value.children) cardObserver.observe(card);
    measureCards();
  },
  { flush: 'post' },
);

watch(
  [list, () => props.layout?.scrollTop],
  () => {
    if (props.layout && panel.value && list.value) panel.value.scrollTop = props.layout.scrollTop;
  },
  { flush: 'post' },
);

function author(item: Annotation) {
  if (item.channel === 'mcp') return 'ШІ';
  const user = identitySession.user.value;
  if (item.creatorId === user?.id) return user.name?.trim() || 'Ви';
  return 'Учасник';
}

watch([dirty, busy], () => emit('dirty', dirty.value || busy.value));

function errorText(problem: unknown, fallback: string) {
  if (problem instanceof ApiError) {
    if (problem.code === 'ANNOTATION_VERSION_CONFLICT' || problem.status === 404)
      return 'Коментар змінився або його видалено. Перегляньте оновлений список.';
    if (problem.code === 'INVALID_ANNOTATION_ANCHOR' || problem.code === 'REVISION_CONFLICT')
      return 'Текст змінився. Виділіть фрагмент знову.';
    if (problem.code === 'ANNOTATION_QUOTA') return 'У проєкті вже є 1000 коментарів.';
  }
  return workspaceError(problem, fallback);
}

async function load() {
  readController?.abort();
  readController = new AbortController();
  const { signal } = readController;
  reading.value = true;
  listError.value = '';
  try {
    const revision = props.revisionId;
    const loaded = new Map<number, Annotation>();
    let cursor: number | null = null;
    do {
      const page = await api.list(revision, cursor, signal);
      if (signal.aborted) return;
      for (const item of page.items) loaded.set(item.id, item);
      cursor = page.nextCursor;
    } while (cursor !== null);
    items.value = [...loaded.values()];
    emit('list', items.value);
  } catch (problem) {
    if (!signal.aborted)
      listError.value = workspaceError(problem, 'Перевірте з’єднання й повторіть спробу.');
  } finally {
    if (!signal.aborted) reading.value = false;
  }
}

watch(
  () => props.revisionId,
  () => {
    items.value = [];
    visibleCount.value = pageSize;
    emit('list', []);
    void load();
  },
  { immediate: true },
);

watch(
  () => props.open,
  (open) => {
    if (open) {
      if (!reading.value) void load();
    } else {
      resetEditor();
      filter.value = 'active';
      visibleCount.value = pageSize;
      chosen.value = null;
    }
  },
);

function resetEditor() {
  editing.value = null;
  body.value = '';
  error.value = '';
  attempt.value = null;
}

function requestDiscard(where: 'editor' | 'panel') {
  if (busy.value) return;
  if (dirty.value) discard.value = where;
  else if (where === 'panel') emit('dismiss');
  else resetEditor();
}

function confirmDiscard() {
  const where = discard.value;
  discard.value = null;
  resetEditor();
  if (where === 'panel') emit('dismiss');
}

async function start(anchor = props.selection, item?: Annotation) {
  if (busy.value || editing.value || (!item && !anchor)) return;
  editing.value = { item: item ?? null, anchor };
  body.value = item?.body ?? '';
  error.value = '';
  await nextTick();
  input.value?.focus();
}

async function submit() {
  const draft = editing.value;
  const value = body.value.trim();
  const signal = lifetime.signal;
  if (!draft || !value || bodyTooLong.value || busy.value || props.locked) return;
  busy.value = true;
  error.value = '';
  try {
    if (draft.item) await api.update(draft.item, { body: value }, signal);
    else {
      if (!attempt.value) {
        const revisionId = await props.prepare(draft.anchor!);
        if (signal.aborted) return;
        if (revisionId === null) {
          error.value = 'Збережіть правки або виділіть фрагмент знову.';
          return;
        }
        attempt.value = {
          body: {
            baseRevisionId: revisionId,
            operations: [{ type: 'createAnnotation', anchor: draft.anchor!, body: value }],
          },
          key: crypto.randomUUID(),
        };
      }
      await workspace.save(props.projectId, attempt.value.body, attempt.value.key, signal);
      filter.value = 'active';
    }
    if (signal.aborted) return;
    resetEditor();
    await load();
  } catch (problem) {
    if (signal.aborted) return;
    if (problem instanceof ApiError && problem.status >= 400 && problem.status < 500)
      attempt.value = null;
    error.value = errorText(
      problem,
      attempt.value
        ? 'Збереження не підтверджено. Повторіть спробу, щоб не створити дублікат.'
        : 'Не вдалося зберегти коментар. Спробуйте ще раз.',
    );
    if (draft.item) await load();
  } finally {
    busy.value = false;
  }
}

async function mutate(item: Annotation, action: 'toggle' | 'remove' | 'reanchor') {
  if (busy.value || props.locked || editing.value) return;
  busy.value = true;
  error.value = '';
  const signal = lifetime.signal;
  try {
    if (action === 'remove') {
      await api.remove(item, signal);
    } else if (action === 'toggle') {
      const status = item.status === 'active' ? 'resolved' : 'active';
      await api.update(item, { status }, signal);
    } else {
      const anchor = props.selection;
      const revisionId = anchor && (await props.prepare(anchor));
      if (!anchor || !revisionId) {
        error.value = 'Збережіть правки або виділіть новий фрагмент.';
        return;
      }
      await api.update(item, { anchor, revisionId }, signal);
    }
  } catch (problem) {
    if (!signal.aborted) error.value = errorText(problem, 'Не вдалося застосувати дію.');
  } finally {
    if (!signal.aborted) {
      removeTarget.value = null;
      await load();
    }
    busy.value = false;
  }
}

async function show(id: number, focus = false) {
  chosen.value = id;
  emit('highlight', id);
  const item = items.value.find((candidate) => candidate.id === id);
  if (item && filter.value !== 'all') filter.value = item.status;
  const index = orderedCards.value.findIndex((candidate) => candidate.id === id);
  visibleCount.value = Math.max(visibleCount.value, index + 1);
  await nextTick();
  const card = panel.value?.querySelector<HTMLElement>(`[data-comment-card="${id}"]`);
  if (focus) card?.focus({ preventScroll: true });
  card?.scrollIntoView({ block: 'nearest' });
}

function reveal(item: Annotation) {
  if (editing.value || busy.value) return;
  chosen.value = item.id;
  emit('highlight', item.id);
  emit('reveal', item);
}

function closeOptions(options: HTMLDetailsElement, restoreFocus = false) {
  options.open = false;
  if (restoreFocus) options.querySelector('summary')?.focus({ preventScroll: true });
}

function dismissOptions(event: PointerEvent) {
  const options = panel.value?.querySelector<HTMLDetailsElement>('.comment-options[open]');
  if (options && !options.contains(event.target as Node)) closeOptions(options);
}

function escapeOptions(event: KeyboardEvent) {
  const options = event.currentTarget as HTMLDetailsElement;
  if (!options.open) return;
  event.stopPropagation();
  event.preventDefault();
  closeOptions(options, true);
}

function chooseOption(event: MouseEvent) {
  const button = (event.target as Element).closest('button');
  if (button) closeOptions(event.currentTarget as HTMLDetailsElement, true);
}

defineExpose({
  start,
  show,
  focus: () => panel.value?.focus({ preventScroll: true }),
  requestClose: () => requestDiscard('panel'),
});
onMounted(() => document.addEventListener('pointerdown', dismissOptions));
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', dismissOptions);
  cardObserver?.disconnect();
  lifetime.abort();
  readController?.abort();
  emit('dirty', false);
});
</script>

<template>
  <component
    :is="compact ? ModalDialog : 'aside'"
    v-if="open"
    v-bind="
      compact
        ? { open: true, title: 'Коментарі', busy, dialogClass: 'workspace-comments-modal' }
        : { class: 'workspace-comments-panel', 'aria-label': 'Коментарі' }
    "
    @dismiss="requestDiscard('panel')"
  >
    <div ref="panel" class="workspace-comments" tabindex="-1">
      <div class="comments-controls">
        <header class="comments-head">
          <h2 v-if="!compact">Коментарі</h2>
          <button
            type="button"
            class="file-icon-button"
            aria-label="Закрити коментарі"
            title="Закрити коментарі"
            :disabled="busy"
            @click="requestDiscard('panel')"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
              <path d="m5 5 10 10M15 5 5 15" fill="none" stroke="currentColor" stroke-width="1.6" />
            </svg>
          </button>
        </header>
        <div v-if="!editing && !listError" class="comments-tools">
          <select v-model="filter" aria-label="Статус коментарів">
            <option value="active">Відкриті</option>
            <option value="resolved">Вирішені</option>
            <option value="all">Усі</option>
          </select>
          <button
            type="button"
            class="button button-quiet"
            :disabled="reading || busy"
            @click="load()"
          >
            Оновити
          </button>
        </div>
      </div>

      <form v-if="editing" class="comment-form" @submit.prevent="submit">
        <label for="workspace-comment-body">{{ heading }}</label>
        <blockquote>{{ editing.anchor?.quote ?? editing.item?.anchor.quote }}</blockquote>
        <textarea
          id="workspace-comment-body"
          ref="input"
          v-model="body"
          rows="3"
          maxlength="10000"
          placeholder="Напишіть коментар…"
          :aria-invalid="bodyTooLong"
          :aria-describedby="bodyTooLong ? 'workspace-comment-length' : undefined"
          :readonly="busy || attempt !== null"
          @keydown.ctrl.enter.prevent="submit"
          @keydown.meta.enter.prevent="submit"
        />
        <p v-if="bodyTooLong" id="workspace-comment-length" class="field-error" role="alert">
          Коментар має містити не більше 5000 символів.
        </p>
        <div class="comment-actions comment-form-actions">
          <button
            type="button"
            class="button button-quiet"
            :disabled="busy"
            @click="requestDiscard('editor')"
          >
            Скасувати
          </button>
          <button
            type="submit"
            class="button button-primary"
            :disabled="busy || locked || !body.trim() || bodyTooLong"
          >
            {{ attempt ? 'Повторити збереження' : editing.item ? 'Зберегти' : 'Додати коментар' }}
          </button>
        </div>
      </form>
      <p v-if="error" role="alert" class="field-error">{{ error }}</p>
      <div v-if="!editing && listError" class="comments-load-error">
        <p role="alert">Не вдалося завантажити коментарі.</p>
        <button
          type="button"
          class="button button-secondary"
          :disabled="reading || busy"
          @click="load()"
        >
          Повторити
        </button>
      </div>
      <p v-if="!editing && reading && !items.length" role="status">Завантаження коментарів…</p>
      <p v-else-if="!editing && !filtered.length && !listError" class="muted">
        {{
          filter === 'active'
            ? 'Немає відкритих коментарів.'
            : filter === 'resolved'
              ? 'Немає вирішених коментарів.'
              : 'Коментарів поки немає.'
        }}
      </p>
      <ol
        v-if="!editing && filtered.length"
        ref="list"
        class="comment-list"
        :style="
          layout ? { minHeight: `${Math.max(0, layout.scrollHeight + topAdjust)}px` } : undefined
        "
      >
        <li
          v-for="item in cards"
          :key="item.id"
          class="comment-card"
          :class="{ 'comment-selected': chosen === item.id }"
          :data-comment-card="item.id"
          tabindex="-1"
          :style="{ marginTop: `${cardGaps[item.id] ?? 0}px` }"
        >
          <div class="comment-card-header">
            <div class="comment-author">
              <strong>{{ author(item) }}</strong>
              <time :datetime="item.createdAt">{{ date.format(new Date(item.createdAt)) }}</time>
            </div>
            <div class="comment-card-controls">
              <button
                type="button"
                class="file-icon-button"
                :disabled="busy || locked"
                :aria-label="item.status === 'active' ? 'Позначити вирішеним' : 'Відкрити знову'"
                @click="mutate(item, 'toggle')"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                  aria-hidden="true"
                >
                  <path v-if="item.status === 'active'" d="m4 10 4 4 8-8" />
                  <path v-else d="M5 8a6 6 0 1 1 0 6m0-6V4m0 4h4" />
                </svg>
              </button>
              <details
                class="comment-options"
                name="workspace-comment-options"
                @keydown.esc="escapeOptions"
                @click="chooseOption"
              >
                <summary class="file-icon-button" aria-label="Дії з коментарем">
                  <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
                    <circle cx="10" cy="5" r="1.25" fill="currentColor" />
                    <circle cx="10" cy="10" r="1.25" fill="currentColor" />
                    <circle cx="10" cy="15" r="1.25" fill="currentColor" />
                  </svg>
                </summary>
                <div>
                  <button
                    type="button"
                    class="button button-quiet"
                    :disabled="busy || locked"
                    @click="start(null, item)"
                  >
                    Редагувати
                  </button>
                  <button
                    v-if="selection"
                    type="button"
                    class="button button-quiet"
                    :disabled="busy || locked"
                    @click="mutate(item, 'reanchor')"
                  >
                    Переприв’язати до виділення
                  </button>
                  <button
                    type="button"
                    class="button button-quiet"
                    :disabled="busy || locked"
                    @click="removeTarget = item"
                  >
                    Видалити
                  </button>
                </div>
              </details>
            </div>
          </div>
          <span v-if="layout?.positions[item.id] === undefined" class="comment-path">{{
            paths.get(item.fileId) ?? 'Файл вилучено'
          }}</span>
          <button
            v-if="item.position.state === 'attached' && !dirtyFileIds.includes(item.fileId)"
            type="button"
            class="comment-quote"
            :disabled="editing !== null || busy"
            @click="reveal(item)"
          >
            {{ item.anchor.quote }}
          </button>
          <template v-else>
            <blockquote>{{ item.anchor.quote }}</blockquote>
            <small v-if="item.position.state === 'outdated'">Фрагмент змінився</small>
            <small v-else-if="item.position.state === 'attached'"
              >Збережіть файл, щоб перейти до цитати.</small
            >
          </template>
          <p>{{ item.body }}</p>
        </li>
      </ol>
      <button
        v-if="!editing && visibleCount < orderedCards.length"
        type="button"
        class="button button-secondary"
        :disabled="reading"
        @click="visibleCount += pageSize"
      >
        Показати ще
      </button>
    </div>
    <ModalDialog
      :open="removeTarget !== null"
      title="Видалити коментар?"
      :busy="busy"
      @dismiss="removeTarget = null"
    >
      <p>Коментар буде видалено без можливості відновлення.</p>
      <div class="modal-actions">
        <button
          type="button"
          class="button button-secondary"
          :disabled="busy"
          @click="removeTarget = null"
        >
          Скасувати
        </button>
        <button
          type="button"
          class="button button-danger"
          :disabled="busy"
          @click="removeTarget && mutate(removeTarget, 'remove')"
        >
          Видалити
        </button>
      </div>
    </ModalDialog>
    <ModalDialog
      :open="discard !== null"
      title="Відкинути чернетку коментаря?"
      @dismiss="discard = null"
    >
      <p>
        {{
          attempt
            ? 'Збереження не підтверджено. Перевірте список коментарів після закриття.'
            : 'Незбережений текст коментаря буде втрачено.'
        }}
      </p>
      <div class="modal-actions">
        <button type="button" class="button button-secondary" @click="discard = null">
          Продовжити редагування
        </button>
        <button type="button" class="button button-danger" @click="confirmDiscard">
          Відкинути
        </button>
      </div>
    </ModalDialog>
  </component>
</template>

<style scoped>
.workspace-comments {
  min-width: 0;
  min-height: 0;
  height: 100%;
  padding: 12px;
  overflow: auto;
  overscroll-behavior: contain;
  overflow-wrap: anywhere;
}
.comments-head,
.comments-tools,
.comment-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.comments-head {
  justify-content: space-between;
}
.comments-head h2 {
  margin: 0;
  font-size: 14px;
}
.comments-head > button {
  margin-left: auto;
}
.comments-tools {
  margin-block: 4px 12px;
}
.comments-tools select {
  min-width: 8rem;
  min-height: 34px;
  padding: 4px 9px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
}
.comment-form,
.comment-card {
  display: grid;
  min-width: 0;
  gap: 6px;
  margin: 0;
  padding: 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-panel);
  background: var(--color-surface);
}
.comment-form label {
  font-weight: 600;
  font-size: 13px;
}
.comment-form {
  gap: 10px;
  padding: 12px;
}
.comment-form blockquote {
  font-family: var(--font-code);
  background: var(--color-background);
  padding-block: 5px;
}
.comment-form textarea {
  min-width: 0;
  resize: vertical;
  padding: 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  font: inherit;
  width: 100%;
  min-height: 6rem;
}
.comment-form textarea:focus-visible {
  outline-width: 2px;
  outline-offset: 1px;
}
.comment-form-actions {
  justify-content: flex-end;
}
.comments-load-error {
  margin-top: 8px;
  padding: 10px 0;
  border-top: 1px solid var(--color-border);
}
.comments-load-error p {
  margin: 0 0 8px;
}
@media (max-width: 720px) {
  .comments-tools select,
  .comment-quote {
    min-height: 44px;
    font-size: 16px;
  }
}
.comment-list {
  display: grid;
  align-content: start;
  gap: 8px;
  margin: 8px 0;
  padding: 0;
  list-style: none;
}
.workspace-comments-panel .comments-controls {
  position: sticky;
  top: -12px;
  z-index: 3;
  padding-block: 6px 2px;
  background: #f8fafc;
}
.comment-card {
  border-inline-start: 3px solid #d5a540;
}
.comment-selected {
  border-color: var(--color-primary);
  background: #f3faff;
}
.comment-card-header {
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 6px;
  min-width: 0;
}
.comment-author {
  display: grid;
  min-width: 0;
  font-size: 13px;
}
.comment-author time {
  color: var(--color-muted);
  font-size: 11px;
}
.comment-card-controls {
  display: flex;
  gap: 2px;
  flex: 0 0 auto;
}
.comment-card-controls .file-icon-button {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
}
@media (max-width: 720px) {
  .comment-card-controls .file-icon-button {
    width: 44px;
    height: 44px;
  }
}
.comment-card p,
blockquote,
.comment-quote {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 13px;
}
.comment-card small,
.comment-path {
  color: var(--color-muted);
  font-size: 12px;
}
blockquote,
.comment-quote {
  display: block;
  max-height: 7lh;
  padding: 2px 8px;
  overflow: auto;
  border: 0;
  border-inline-start: 2px solid var(--color-border);
  background: transparent;
  color: var(--color-muted);
  text-align: left;
}
.comment-quote {
  cursor: pointer;
}
.comment-quote:hover:not(:disabled) {
  color: var(--color-primary);
}
.comment-actions {
  justify-content: space-between;
}
.comment-options summary {
  list-style: none;
  cursor: pointer;
}
.comment-options summary::-webkit-details-marker {
  display: none;
}
.comment-options[open] summary {
  background: var(--color-background);
  color: var(--color-primary);
}
.comment-options > div {
  position: absolute;
  inset-inline-end: 0;
  top: 100%;
  z-index: 2;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  width: min(15rem, 100%);
  padding: 4px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  box-shadow: 0 3px 12px #102b4924;
}
.comment-options > div button {
  justify-content: flex-start;
  padding-inline: 10px;
  white-space: normal;
  text-align: start;
  color: var(--color-text);
}
.comment-options > div button:hover:not(:disabled) {
  background: var(--color-background);
}
@media (max-width: 720px) {
  .comment-options > div button {
    min-height: 44px;
  }
}
</style>
