<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ApiError } from '../../shared/api/client';
import { identitySession } from '../identity/identity-session';
import ModalDialog from '../../shared/ui/ModalDialog.vue';
import { createHistoryApi } from './history-api';
import type { Revision, RevisionDiff } from './history-api';
import type { Snapshot, TextFile } from './workspace-api';

const props = defineProps<{
  projectId: number;
  headId: number;
  canRestore: boolean;
  busy: boolean;
}>();
const emit = defineEmits<{
  restore: [{ id: number; number: number; expectedHeadId: number }];
  refresh: [];
}>();
const api = createHistoryApi(identitySession.request);
const revisions = ref<Revision[]>([]);
const nextCursor = ref<number | null>(null);
const selectedId = ref<number | null>(null);
const diff = ref<RevisionDiff | null>(null);
const fromPaths = ref<Map<number, string>>(new Map());
const toPaths = ref<Map<number, string>>(new Map());
const loading = ref(false);
const loadingMore = ref(false);
const error = ref('');
const diffError = ref('');
const moreError = ref('');
const restoreOpen = ref(false);
const expandedFiles = ref(new Set<number>());
const expandedContext = ref(false);
const snapshotOpen = ref(false);
const snapshotLoading = ref(false);
const snapshotError = ref('');
const snapshot = ref<Snapshot | null>(null);
const snapshotFileId = ref<number | null>(null);
const snapshotText = ref<TextFile | null>(null);
const snapshotTextLoading = ref(false);
const snapshotTextError = ref('');
const mobileSnapshotFileId = ref<number | null>(null);
const isMobile = ref(window.matchMedia('(max-width: 720px)').matches);
const listHeading = ref<HTMLElement | null>(null);
const snapshotToggle = ref<HTMLButtonElement | null>(null);
const snapshotBack = ref<HTMLButtonElement | null>(null);
const detailBack = ref<HTMLButtonElement | null>(null);
const snapshotListHeading = ref<HTMLElement | null>(null);
let listController: AbortController | null = null;
let diffController: AbortController | null = null;
let snapshotController: AbortController | null = null;
let textController: AbortController | null = null;
let listSequence = 0;
let diffSequence = 0;
let snapshotSequence = 0;
let textSequence = 0;
const mobileQuery = window.matchMedia('(max-width: 720px)');
const selected = computed(
  () => revisions.value.find((item) => item.id === selectedId.value) ?? null,
);
const snapshotFile = computed(
  () => snapshot.value?.tree.find((file) => file.fileId === snapshotFileId.value) ?? null,
);
const current = computed(() => revisions.value.find((item) => item.isCurrent) ?? null);
const latestDisagrees = computed(() => !!current.value && current.value.id !== props.headId);
const canConfirmRestore = computed(
  () =>
    props.canRestore &&
    !latestDisagrees.value &&
    !!selected.value &&
    !!diff.value &&
    !loading.value &&
    diff.value.toRevisionId === props.headId &&
    diff.value.fromRevisionId === selected.value.id &&
    selected.value.id !== props.headId &&
    !props.busy,
);
function patchLines(patch: string) {
  const lines = patch.split('\n');
  const firstHunk = lines.findIndex((line) => line.startsWith('@@'));
  if (firstHunk < 0) return [];
  return lines
    .slice(firstHunk)
    .filter((line) => line.length > 0)
    .map((line) => ({
      line,
      kind: line.startsWith('+')
        ? 'added'
        : line.startsWith('-')
          ? 'removed'
          : line.startsWith('@@')
            ? 'hunk'
            : 'context',
    }));
}

function displayedLines(patch: string, expanded: boolean) {
  const lines = patchLines(patch);
  return {
    lines: expanded ? lines : lines.slice(0, 140),
    hasMore: lines.length > 140,
  };
}

function errorText(value: unknown, fallback: string) {
  if (value instanceof ApiError) {
    if (value.status === 401) return 'Сеанс завершився. Увійдіть знову, щоб продовжити.';
    if (value.status === 403) return 'Немає доступу до історії цього проєкту.';
    if (value.status === 404) return 'Ця версія більше недоступна.';
    if (value.status === 429) return 'Забагато запитів. Спробуйте трохи пізніше.';
  }
  return fallback;
}

async function loadPage(cursor?: number, append = false) {
  listController?.abort();
  const controller = new AbortController();
  listController = controller;
  const sequence = ++listSequence;
  if (append) {
    loadingMore.value = true;
    moreError.value = '';
  } else {
    loading.value = true;
    error.value = '';
  }
  try {
    const page = await api.list(props.projectId, cursor, controller.signal);
    if (sequence !== listSequence) return;
    revisions.value = append ? [...revisions.value, ...page.items] : page.items;
    nextCursor.value = page.nextCursor;
    if (!append && selectedId.value && revisions.value.some((item) => item.id === selectedId.value))
      await select(selectedId.value);
  } catch (value) {
    if (!controller.signal.aborted && sequence === listSequence) {
      const message = errorText(value, 'Не вдалося завантажити історію. Спробуйте ще раз.');
      if (append) moreError.value = message;
      else error.value = message;
    }
  } finally {
    if (sequence === listSequence) {
      loading.value = false;
      loadingMore.value = false;
    }
  }
}

async function select(id: number) {
  if (id === props.headId) {
    selectedId.value = null;
    diff.value = null;
    snapshot.value = null;
    snapshotOpen.value = false;
    return;
  }
  selectedId.value = id;
  if (isMobile.value) void nextTick(() => detailBack.value?.focus({ preventScroll: true }));
  snapshotController?.abort();
  textController?.abort();
  snapshot.value = null;
  snapshotFileId.value = null;
  snapshotText.value = null;
  snapshotOpen.value = false;
  diffController?.abort();
  const controller = new AbortController();
  diffController = controller;
  const sequence = ++diffSequence;
  diff.value = null;
  diffError.value = '';
  expandedFiles.value = new Set();
  expandedContext.value = false;
  try {
    const [result, fromState, toState] = await Promise.all([
      api.diff(props.projectId, id, props.headId, controller.signal),
      api.state(props.projectId, id, controller.signal),
      api.state(props.projectId, props.headId, controller.signal),
    ]);
    if (sequence !== diffSequence || selectedId.value !== id) return;
    diff.value = result;
    fromPaths.value = new Map(fromState.tree.map((file) => [file.fileId, file.path]));
    toPaths.value = new Map(toState.tree.map((file) => [file.fileId, file.path]));
  } catch (value) {
    if (!controller.signal.aborted && sequence === diffSequence)
      diffError.value = errorText(value, 'Не вдалося порівняти версії. Спробуйте ще раз.');
  }
}

function showList() {
  selectedId.value = null;
  diff.value = null;
  diffController?.abort();
  snapshotController?.abort();
  textController?.abort();
  snapshotOpen.value = false;
  void nextTick(() => listHeading.value?.focus({ preventScroll: true }));
}

async function openSnapshot() {
  snapshotOpen.value = true;
  snapshotError.value = '';
  mobileSnapshotFileId.value = null;
  if (snapshot.value?.revision.id === selected.value?.id) {
    if (isMobile.value)
      void nextTick(() => snapshotListHeading.value?.focus({ preventScroll: true }));
    return;
  }
  snapshotController?.abort();
  const controller = new AbortController();
  snapshotController = controller;
  const sequence = ++snapshotSequence;
  snapshotLoading.value = true;
  try {
    const result = await api.state(props.projectId, selected.value!.id, controller.signal);
    if (sequence !== snapshotSequence || selected.value?.id !== result.revision.id) return;
    snapshot.value = result;
    if (isMobile.value)
      void nextTick(() => snapshotListHeading.value?.focus({ preventScroll: true }));
  } catch (value) {
    if (!controller.signal.aborted && sequence === snapshotSequence)
      snapshotError.value = errorText(value, 'Не вдалося завантажити файли цієї версії.');
  } finally {
    if (sequence === snapshotSequence) snapshotLoading.value = false;
  }
}

async function selectSnapshotFile(fileId: number) {
  if (!snapshot.value) return;
  const metadata = snapshot.value.tree.find((file) => file.fileId === fileId);
  if (!metadata) return;
  snapshotFileId.value = fileId;
  snapshotText.value = null;
  snapshotTextError.value = '';
  if (isMobile.value) mobileSnapshotFileId.value = fileId;
  if (isMobile.value) void nextTick(() => snapshotBack.value?.focus({ preventScroll: true }));
  textController?.abort();
  if (metadata.contentKind !== 'text') return;
  const controller = new AbortController();
  textController = controller;
  const sequence = ++textSequence;
  snapshotTextLoading.value = true;
  try {
    const result = await api.text(
      props.projectId,
      fileId,
      snapshot.value.revision.id,
      controller.signal,
    );
    if (sequence === textSequence && snapshotFileId.value === fileId) snapshotText.value = result;
  } catch (value) {
    if (!controller.signal.aborted && sequence === textSequence)
      snapshotTextError.value = errorText(value, 'Не вдалося завантажити текст цієї версії.');
  } finally {
    if (sequence === textSequence) snapshotTextLoading.value = false;
  }
}

function backToSnapshotFiles() {
  mobileSnapshotFileId.value = null;
  void nextTick(() => snapshotBack.value?.focus({ preventScroll: true }));
}

function closeSnapshot() {
  snapshotOpen.value = false;
  mobileSnapshotFileId.value = null;
  snapshotController?.abort();
  textController?.abort();
  void nextTick(() => snapshotToggle.value?.focus({ preventScroll: true }));
}

function toggleSnapshot() {
  if (snapshotOpen.value) closeSnapshot();
  else void openSnapshot();
}

function handleEscape(event: KeyboardEvent) {
  if (restoreOpen.value || !isMobile.value) return;
  if (snapshotOpen.value) {
    if (mobileSnapshotFileId.value !== null) backToSnapshotFiles();
    else closeSnapshot();
    event.preventDefault();
    return;
  }
  if (selectedId.value !== null) {
    showList();
    event.preventDefault();
  }
}

function viewportChanged(event: MediaQueryListEvent) {
  isMobile.value = event.matches;
  mobileSnapshotFileId.value = null;
}

function confirmRestore() {
  if (!canConfirmRestore.value || !selected.value) return;
  emit('restore', {
    id: selected.value.id,
    number: selected.value.number,
    expectedHeadId: props.headId,
  });
  restoreOpen.value = false;
}

function operationLabel(revision: Revision) {
  if (revision.operation === 'restore') return 'Відновлення версії';
  if (revision.operation === 'save') return 'Зміни проєкту';
  if (revision.operation === 'create') return 'Створення проєкту';
  return 'Зміни проєкту';
}
function revisionTitle(revision: Revision) {
  if (revision.operation === 'save' && revision.summary === 'Updated project')
    return 'Зміни проєкту';
  if (revision.operation === 'create' && revision.summary === 'Created project')
    return 'Створення проєкту';
  if (revision.operation === 'restore' && /^Restored revision \d+$/.test(revision.summary))
    return 'Відновлення версії';
  return revision.summary || operationLabel(revision);
}
function dateLabel(value: string) {
  return new Intl.DateTimeFormat('uk-UA', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}
function omittedReason(reason: string | null) {
  if (reason === 'BINARY') return 'Бінарний файл';
  if (reason === 'TEXT_TOO_LARGE') return 'Текст завеликий для порівняння';
  if (reason === 'COMPUTATION_LIMIT') return 'Порівняння зайняло забагато часу';
  if (reason === 'PATCH_LIMIT') return 'Показано обмежену частину порівняння';
  return 'Немає текстового порівняння';
}
function formatBytes(value: number) {
  if (value < 1024) return `${value} Б`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} КБ`;
  return `${(value / (1024 * 1024)).toFixed(1)} МБ`;
}

watch(
  () => props.headId,
  (id, previous) => {
    if (id === previous) return;
    selectedId.value = null;
    diff.value = null;
    diffController?.abort();
    snapshotController?.abort();
    textController?.abort();
    snapshot.value = null;
    snapshotOpen.value = false;
    snapshotFileId.value = null;
    snapshotText.value = null;
    void loadPage();
  },
);
onMounted(() => {
  mobileQuery.addEventListener('change', viewportChanged);
  void loadPage();
});
onBeforeUnmount(() => {
  listController?.abort();
  diffController?.abort();
  snapshotController?.abort();
  textController?.abort();
  mobileQuery.removeEventListener('change', viewportChanged);
});
</script>

<template>
  <section class="workspace-history" aria-label="Історія версій" @keydown.esc="handleEscape">
    <aside class="history-list" :class="{ 'history-list-hidden': selectedId !== null }">
      <header class="history-list-heading">
        <h2 ref="listHeading" tabindex="-1">Версії</h2>
        <button v-if="latestDisagrees" class="button button-quiet" @click="emit('refresh')">
          Оновити стан
        </button>
      </header>
      <p v-if="latestDisagrees" class="history-inline-note" role="status">
        Стан проєкту змінився. Оновіть його перед порівнянням.
      </p>
      <div v-if="loading" class="history-state" role="status">Завантаження історії…</div>
      <div v-else-if="error" class="history-state" role="alert">
        <p>{{ error }}</p>
        <button class="button button-secondary" @click="loadPage()">Повторити</button>
      </div>
      <p v-else-if="!revisions.length" class="history-state">Історія поки порожня.</p>
      <ul v-else class="history-revision-list">
        <li v-for="revision in revisions" :key="revision.id">
          <button
            class="history-revision"
            :class="{
              'history-revision-selected': revision.id === selectedId,
              'history-revision-current': revision.id === props.headId,
            }"
            :aria-current="revision.id === selectedId ? 'true' : undefined"
            :disabled="revision.id === props.headId || loading"
            @click="select(revision.id)"
          >
            <span class="history-revision-top"
              ><strong>Версія {{ revision.number }}</strong
              ><span v-if="revision.id === props.headId">Поточна</span></span
            >
            <span class="history-revision-summary">{{ revisionTitle(revision) }}</span>
            <span class="history-revision-meta">{{ dateLabel(revision.createdAt) }}</span>
          </button>
        </li>
      </ul>
      <button
        v-if="nextCursor !== null"
        class="button button-quiet history-more"
        :disabled="loadingMore"
        @click="loadPage(nextCursor, true)"
      >
        {{ loadingMore ? 'Завантаження…' : 'Завантажити раніші версії' }}
      </button>
      <div v-if="moreError" class="history-state" role="alert">
        <p>{{ moreError }}</p>
        <button class="button button-secondary" @click="loadPage(nextCursor ?? undefined, true)">
          Повторити
        </button>
      </div>
    </aside>

    <div class="history-detail" :class="{ 'history-detail-snapshot': snapshotOpen }">
      <template v-if="selected">
        <button ref="detailBack" class="button button-quiet history-back" @click="showList">
          ← Усі версії
        </button>
        <header class="history-detail-heading">
          <div>
            <h2>Версія {{ selected.number }} → Поточна</h2>
            <p>{{ dateLabel(selected.createdAt) }} · {{ revisionTitle(selected) }}</p>
          </div>
          <div class="history-detail-actions">
            <button
              ref="snapshotToggle"
              class="button button-quiet"
              :aria-pressed="snapshotOpen"
              @click="toggleSnapshot"
            >
              {{ snapshotOpen ? 'До порівняння' : 'Файли версії' }}
            </button>
            <button
              class="button button-secondary history-restore-button"
              :disabled="!canConfirmRestore"
              @click="restoreOpen = true"
            >
              Відновити версію
            </button>
          </div>
        </header>
        <div v-if="snapshotOpen" class="history-snapshot-browser">
          <button
            v-if="isMobile && mobileSnapshotFileId === null"
            class="button button-quiet history-back history-snapshot-return"
            @click="closeSnapshot"
          >
            ← До порівняння
          </button>
          <div
            class="history-snapshot-files"
            :class="{ 'history-snapshot-files-hidden': mobileSnapshotFileId !== null }"
          >
            <h3 ref="snapshotListHeading" tabindex="-1">Файли версії {{ selected.number }}</h3>
            <div v-if="snapshotLoading" class="history-state" role="status">
              Завантаження файлів…
            </div>
            <div v-else-if="snapshotError" class="history-state" role="alert">
              <p>{{ snapshotError }}</p>
              <button class="button button-secondary" @click="openSnapshot">Повторити</button>
            </div>
            <ul v-else-if="snapshot" class="history-snapshot-list">
              <li v-for="file in snapshot.tree" :key="file.fileId">
                <button
                  class="history-snapshot-file"
                  :class="{ 'history-snapshot-file-selected': file.fileId === snapshotFileId }"
                  :aria-current="file.fileId === snapshotFileId ? 'true' : undefined"
                  @click="selectSnapshotFile(file.fileId)"
                >
                  <span>{{ file.path }}</span>
                  <small>{{
                    file.contentKind === 'text'
                      ? file.fileId === snapshot.mainFileId
                        ? 'Головний'
                        : 'Текст'
                      : 'Ресурс'
                  }}</small>
                </button>
              </li>
            </ul>
          </div>
          <section
            v-if="snapshot && (!isMobile || mobileSnapshotFileId !== null)"
            class="history-snapshot-content"
          >
            <button
              v-if="isMobile"
              ref="snapshotBack"
              class="button button-quiet history-back"
              @click="backToSnapshotFiles"
            >
              ← Файли версії
            </button>
            <template v-if="snapshotFile">
              <header class="history-snapshot-file-heading">
                <h3>{{ snapshotFile.path }}</h3>
                <span>{{ snapshotFile.contentKind === 'text' ? 'Текст' : 'Ресурс' }}</span>
              </header>
              <p v-if="snapshotFile.fileId === snapshot.mainFileId" class="history-snapshot-meta">
                Головний файл · {{ formatBytes(snapshotFile.sizeBytes) }}
              </p>
              <p v-else class="history-snapshot-meta">
                {{ formatBytes(snapshotFile.sizeBytes) }} · {{ snapshotFile.mediaType }}
              </p>
              <div v-if="snapshotTextLoading" class="history-state" role="status">
                Завантаження тексту…
              </div>
              <div v-else-if="snapshotTextError" class="history-state" role="alert">
                <p>{{ snapshotTextError }}</p>
                <button
                  class="button button-secondary"
                  @click="selectSnapshotFile(snapshotFile.fileId)"
                >
                  Повторити
                </button>
              </div>
              <pre
                v-else-if="snapshotText"
                class="history-snapshot-text"
              ><code>{{ snapshotText.content }}</code></pre>
            </template>
            <p v-else class="history-state">Виберіть файл версії.</p>
          </section>
        </div>
        <template v-else>
          <div v-if="diffError" class="history-state" role="alert">
            <p>{{ diffError }}</p>
            <button class="button button-secondary" @click="select(selected.id)">
              Повторити порівняння
            </button>
          </div>
          <p v-else-if="!diff" class="history-state" role="status">Завантаження порівняння…</p>
          <template v-else>
            <section v-if="diff.files.length" class="history-change-list" aria-label="Зміни файлів">
              <details
                v-for="file in diff.files"
                :key="file.fileId"
                class="history-change history-diff-group"
              >
                <summary class="history-change-heading">
                  <h3>{{ file.before?.path ?? file.after?.path }}</h3>
                  <span>{{
                    file.changes
                      .map(
                        (change) =>
                          ({
                            renamed: 'Перейменовано',
                            modified: 'Змінено',
                            added: 'Додано',
                            deleted: 'Видалено',
                          })[change],
                      )
                      .join(' · ')
                  }}</span>
                </summary>
                <p
                  v-if="file.before?.path !== file.after?.path && file.before && file.after"
                  class="history-path-change"
                >
                  {{ file.before.path }} → {{ file.after.path }}
                </p>
                <p
                  v-if="
                    file.before?.contentKind === 'binary' || file.after?.contentKind === 'binary'
                  "
                  class="history-file-size"
                >
                  {{ file.before ? formatBytes(file.before.sizeBytes) : '—' }} →
                  {{ file.after ? formatBytes(file.after.sizeBytes) : '—' }}
                </p>
                <template v-if="file.patch">
                  <pre
                    class="history-patch"
                  ><code><span v-for="(line, index) in displayedLines(file.patch, expandedFiles.has(file.fileId)).lines" :key="index" :class="`history-line-${line.kind}`">{{ line.line }}
</span></code></pre>
                  <button
                    v-if="displayedLines(file.patch, false).hasMore"
                    class="button button-quiet history-expand-patch"
                    @click.prevent="
                      expandedFiles.has(file.fileId)
                        ? expandedFiles.delete(file.fileId)
                        : expandedFiles.add(file.fileId)
                    "
                  >
                    {{ expandedFiles.has(file.fileId) ? 'Згорнути зміни' : 'Показати решту змін' }}
                  </button>
                </template>
                <p v-else class="history-omitted">{{ omittedReason(file.patchOmittedReason) }}</p>
              </details>
            </section>
            <p v-else-if="!diff.context.changed && !diff.entrypoint.changed" class="history-state">
              У цих версіях немає змін.
            </p>
            <details v-if="diff.context.changed" class="history-change history-diff-group">
              <summary class="history-change-heading">
                <h3>Контекст проєкту</h3>
                <span>Змінено</span>
              </summary>
              <template v-if="diff.context.patch">
                <pre
                  class="history-patch"
                ><code><span v-for="(line, index) in displayedLines(diff.context.patch, expandedContext).lines" :key="index" :class="`history-line-${line.kind}`">{{ line.line }}
</span></code></pre>
                <button
                  v-if="displayedLines(diff.context.patch, false).hasMore"
                  class="button button-quiet history-expand-patch"
                  @click.prevent="expandedContext = !expandedContext"
                >
                  {{ expandedContext ? 'Згорнути зміни' : 'Показати решту змін' }}
                </button>
              </template>
              <p v-else class="history-omitted">
                {{ omittedReason(diff.context.patchOmittedReason) }}
              </p>
            </details>
            <section v-if="diff.entrypoint.changed" class="history-change">
              <h3>Головний файл</h3>
              <p>
                {{ fromPaths.get(diff.entrypoint.beforeFileId) ?? 'Файл недоступний' }} →
                {{ toPaths.get(diff.entrypoint.afterFileId) ?? 'Файл недоступний' }}
              </p>
            </section>
          </template>
        </template>
      </template>
      <p v-else class="history-state history-empty-detail">
        Виберіть версію, щоб переглянути зміни.
      </p>
    </div>

    <ModalDialog
      :open="restoreOpen"
      title="Відновити версію?"
      :busy="busy"
      @dismiss="restoreOpen = false"
    >
      <p>
        Вміст усіх файлів і контексту буде замінено станом версії {{ selected?.number }}. Поточні
        зміни залишаться в історії як окрема версія.
      </p>
      <div class="modal-actions">
        <button class="button button-secondary" :disabled="busy" @click="restoreOpen = false">
          Скасувати
        </button>
        <button
          class="button button-primary"
          :disabled="!canConfirmRestore"
          @click="confirmRestore"
        >
          {{ busy ? 'Відновлення…' : 'Відновити' }}
        </button>
      </div>
    </ModalDialog>
  </section>
</template>

<style scoped>
.workspace-history {
  display: grid;
  grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
  flex: 1;
  min-height: 0;
  background: var(--color-surface);
}
.history-list {
  min-width: 0;
  min-height: 0;
  overflow: auto;
  border-right: 1px solid var(--color-border);
  background: #f8fafc;
}
.history-list-heading {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 44px;
  padding: 0 12px;
  background: #f8fafc;
  border-bottom: 1px solid var(--color-border);
}
.history-list-heading h2,
.history-detail-heading h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}
.history-revision-list {
  list-style: none;
  margin: 0;
  padding: 4px;
}
.history-revision {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
  min-height: 64px;
  padding: 9px 10px;
  border: 0;
  border-left: 2px solid transparent;
  border-radius: 3px;
  background: transparent;
  color: var(--color-text);
  text-align: left;
  cursor: pointer;
}
.history-revision:hover {
  background: #edf2f6;
}
.history-revision-selected {
  background: #e8f2f6;
  border-left-color: var(--color-primary);
}
.history-revision-current {
  cursor: default;
}
.history-revision-top {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
}
.history-revision-top span {
  color: var(--color-primary);
  font-size: 11px;
}
.history-revision-summary {
  overflow: hidden;
  margin-top: 3px;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}
.history-revision-meta {
  margin-top: 3px;
  color: var(--color-muted);
  font-size: 11px;
}
.history-more {
  display: block;
  width: calc(100% - 16px);
  margin: 8px;
}
.history-detail {
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: 16px clamp(14px, 3vw, 36px) 32px;
}
.history-detail-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0 16px;
  border-bottom: 1px solid var(--color-border);
}
.history-detail-heading p {
  margin: 5px 0 0;
  color: var(--color-muted);
  font-size: 12px;
}
.history-detail-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}
.history-back {
  display: none;
}
.history-change-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 12px;
}
.history-change {
  min-width: 0;
  margin-top: 12px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: #fff;
}
.history-change-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 12px;
  border-bottom: 1px solid var(--color-border);
  background: #f8fafc;
}
.history-diff-group > summary {
  list-style: none;
  cursor: pointer;
}
.history-diff-group > summary::-webkit-details-marker {
  display: none;
}
.history-diff-group > summary::before {
  content: '›';
  flex-shrink: 0;
  color: var(--color-muted);
  font-size: 16px;
  transform: rotate(0);
}
.history-diff-group[open] > summary::before {
  transform: rotate(90deg);
}
.history-diff-group > summary h3 {
  flex: 1;
}
.history-change-heading h3,
.history-change h3 {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  font: 12px var(--font-code);
}
.history-change-heading span,
.history-file-size {
  flex-shrink: 0;
  color: var(--color-muted);
  font-size: 11px;
}
.history-path-change,
.history-file-size {
  margin: 7px 12px;
  font-size: 12px;
  overflow-wrap: anywhere;
}
.history-patch {
  max-height: 420px;
  overflow: auto;
  margin: 0;
  padding: 8px 12px;
  background: #fff;
  font: 12px/1.55 var(--font-code);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  tab-size: 2;
}
.history-patch code,
.history-snapshot-text code {
  font: inherit;
}
.history-line-added {
  display: block;
  background: #eaf6ed;
  color: #176b35;
}
.history-line-removed {
  display: block;
  background: #fff0ee;
  color: #a32e28;
}
.history-line-hunk {
  display: block;
  color: #526579;
  background: #f2f5f8;
}
.history-expand-patch {
  margin: 0 10px 8px;
}
.history-omitted {
  margin: 10px 12px;
  color: var(--color-muted);
  font-size: 12px;
}
.history-change > h3 {
  padding: 10px 12px;
}
.history-change > p {
  font-size: 12px;
}
.history-state {
  display: grid;
  justify-items: start;
  gap: 10px;
  padding: 20px 16px;
  color: var(--color-muted);
  font-size: 13px;
}
.history-state p {
  margin: 0;
  color: var(--color-text);
}
.history-inline-note {
  padding: 10px 12px;
  margin: 8px;
  background: #fff8f3;
  border: 1px solid #edd7c6;
  border-radius: 4px;
  font-size: 12px;
}
.history-empty-detail {
  height: 100%;
  place-content: center;
  text-align: center;
}
.history-snapshot-browser {
  display: grid;
  grid-template-columns: minmax(190px, 260px) minmax(0, 1fr);
  min-height: 260px;
  margin-top: 12px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  overflow: hidden;
}
.history-snapshot-files {
  min-width: 0;
  overflow: auto;
  border-right: 1px solid var(--color-border);
  background: #f8fafc;
}
.history-snapshot-files > h3 {
  position: sticky;
  top: 0;
  margin: 0;
  padding: 12px;
  border-bottom: 1px solid var(--color-border);
  background: #f8fafc;
  font-size: 12px;
}
.history-snapshot-list {
  list-style: none;
  margin: 0;
  padding: 4px;
}
.history-snapshot-file {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
  min-height: 42px;
  padding: 7px 8px;
  border: 0;
  border-left: 2px solid transparent;
  background: transparent;
  color: var(--color-text);
  text-align: left;
  cursor: pointer;
}
.history-snapshot-file span {
  width: 100%;
  overflow-wrap: anywhere;
  font: 12px/1.45 var(--font-code);
}
.history-snapshot-file small {
  color: var(--color-muted);
  font-size: 10px;
}
.history-snapshot-file:hover {
  background: #edf2f6;
}
.history-snapshot-file-selected {
  border-left-color: var(--color-primary);
  background: #e8f2f6;
}
.history-snapshot-content {
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: 10px;
}
.history-snapshot-file-heading {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 2px 8px;
  border-bottom: 1px solid var(--color-border);
}
.history-snapshot-file-heading h3 {
  margin: 0;
  overflow-wrap: anywhere;
  font: 12px/1.5 var(--font-code);
}
.history-snapshot-file-heading span,
.history-snapshot-meta {
  color: var(--color-muted);
  font-size: 11px;
}
.history-snapshot-meta {
  margin: 8px 2px;
  overflow-wrap: anywhere;
}
.history-snapshot-text {
  max-height: min(65dvh, 720px);
  overflow: auto;
  margin: 0;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: 3px;
  background: #fff;
  font: 12px/1.55 var(--font-code);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  tab-size: 2;
}
.modal-dialog > p {
  max-width: 430px;
  line-height: 1.55;
}
@media (max-width: 720px) {
  .workspace-history {
    display: block;
    overflow: hidden;
  }
  .history-list {
    height: 100%;
    border-right: 0;
  }
  .history-list-hidden {
    display: none;
  }
  .history-detail {
    display: none;
    height: 100%;
    padding: 10px 12px 24px;
  }
  .history-list-hidden + .history-detail {
    display: block;
  }
  .history-back {
    display: inline-flex;
    min-height: 40px;
    padding-left: 0;
  }
  .history-detail-heading {
    align-items: flex-start;
    flex-direction: column;
  }
  .history-detail-snapshot .history-detail-heading {
    display: none;
  }
  .history-detail-actions {
    width: 100%;
  }
  .history-detail-actions > button {
    flex: 1;
  }
  .history-restore-button {
    width: 100%;
  }
  .history-revision {
    min-height: 68px;
    padding: 10px;
  }
  .history-patch {
    max-height: 45dvh;
    font-size: 11px;
  }
  .history-inline-note {
    margin: 6px;
  }
  .history-diff-group > summary {
    min-height: 44px;
    gap: 7px;
  }
  .history-snapshot-browser {
    display: flex;
    flex-direction: column;
    min-height: 0;
    margin-top: 0;
    border: 0;
  }
  .history-snapshot-return {
    display: inline-flex;
    align-self: flex-start;
    margin: 0 0 8px;
  }
  .history-snapshot-files {
    min-height: 0;
    border: 0;
  }
  .history-snapshot-files-hidden {
    display: none;
  }
  .history-snapshot-content {
    min-height: 0;
    padding: 0;
  }
  .history-snapshot-text {
    max-height: 62dvh;
    font-size: 11px;
  }
}
</style>
