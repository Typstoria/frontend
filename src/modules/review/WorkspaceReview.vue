<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  ref,
  shallowRef,
  watch,
} from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { identitySession } from '../identity/identity-session';
import { ApiError } from '../../shared/api/client';
import ModalDialog from '../../shared/ui/ModalDialog.vue';
import { createWorkspaceApi, validId } from '../workspace/workspace-api';
import { diagnosticSource } from '../workspace/compilation-diagnostics';
import type { Material } from '../workspace/material-metadata';
import ReviewChanges from './ReviewChanges.vue';
import {
  createReviewApi,
  type Proposal,
  type ProposalCandidate,
  type ProposalDiff,
  type ProposalValidation,
  type ReviewAnnotation,
} from './review-api';
import type { components } from '../../shared/api/schema';

const props = defineProps<{
  projectId: number;
  headId: number;
  headNumber: number;
  canDecide: boolean;
  refreshAccepted: (revisionNumber: number) => Promise<void>;
}>();
const emit = defineEmits<{ busy: [boolean]; dismiss: [] }>();
const PdfDocument = defineAsyncComponent(() => import('../workspace/PdfDocument.vue'));
const route = useRoute();
const api = createReviewApi(identitySession.request);
const workspace = createWorkspaceApi(identitySession.request);
const listPath = `/projects/${props.projectId}/proposals`;
const selectedId = computed(() => Number(route.params.proposalId) || null);
const items = shallowRef<Proposal[]>([]);
const cursor = ref<number | null>(null);
const loadingList = ref(true);
const listError = ref('');
const listFocus = ref<HTMLElement | null>(null);
const detailFocus = ref<HTMLElement | null>(null);
const detailPane = ref<HTMLElement | null>(null);
const lifetime = new AbortController();
let detailController: AbortController | undefined;
let fileController: AbortController | undefined;
let pollController: AbortController | undefined;
const proposal = shallowRef<Proposal | null>(null);
const candidate = shallowRef<ProposalCandidate | null>(null);
const baseNumber = ref<number | null>(null);
const diff = shallowRef<ProposalDiff | null>(null);
const annotations = shallowRef(new Map<number, ReviewAnnotation>());
const annotationsLoading = ref(false);
const annotationsError = ref('');
const loadingDetail = ref(false);
const detailError = ref('');
const validation = shallowRef<ProposalValidation | null>(null);
const validationError = ref('');
const pdf = shallowRef<Blob | null>(null);
const pdfError = ref('');
const pdfLoading = ref(false);
const showPdf = ref(false);
const selectedFileId = ref<number | null>(null);
const fileText = shallowRef<components['schemas']['ProposalTextFileDto'] | null>(null);
const fileLoading = ref(false);
const fileError = ref('');
const downloadError = ref('');
const downloading = ref(false);
const busy = ref(false);
const actionError = ref('');
const notice = ref('');
const decision = ref<'compile-error' | 'reject' | 'rebase' | null>(null);
const acknowledged = ref(false);
const syncRevision = ref<number | null>(null);

let acceptAttempt: { validationId: number; key: string } | undefined;

const date = new Intl.DateTimeFormat('uk', { dateStyle: 'short', timeStyle: 'short' });
const statusLabels = {
  draft: 'Очікує рішення',
  accepted: 'Прийнято',
  rejected: 'Відхилено',
  expired: 'Термін дії минув',
};
const validationLabels = {
  not_required: 'Компіляція не потрібна',
  queued: 'Очікує компіляції…',
  running: 'Компіляція…',
  succeeded: 'Перевірку пройдено',
  compile_failed: 'Помилка Typst',
  validation_failed: 'Компіляцію не завершено',
};
const stale = computed(
  () =>
    proposal.value?.status === 'draft' &&
    (proposal.value.isStale || props.headId > proposal.value.baseRevisionId),
);
const active = computed(() => !!proposal.value && proposal.value.status === 'draft');
const monitoring = ref(false);
const waiting = computed(() => ['queued', 'running'].includes(validation.value?.status ?? ''));
const annotationConflict = computed(
  () =>
    diff.value?.annotationOperations.some(
      (op) =>
        op.type === 'resolveAnnotation' &&
        annotations.value.get(op.annotationId)?.version !== op.expectedAnnotationVersion,
    ) ?? false,
);
const canAccept = computed(
  () =>
    active.value &&
    props.canDecide &&
    !stale.value &&
    !busy.value &&
    !annotationsLoading.value &&
    !annotationConflict.value &&
    !!diff.value &&
    !!candidate.value &&
    !!validation.value &&
    ['not_required', 'succeeded', 'compile_failed'].includes(validation.value.status),
);
watch(busy, (value) => emit('busy', value), { flush: 'sync' });

function errorText(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    if (error.status === 403 || error.status === 404) return 'Пропозиція або проєкт недоступні.';
    if (error.status === 429) return 'Забагато запитів. Спробуйте трохи пізніше.';
    if (error.code === 'UPLOAD_EXPIRED')
      return 'Строк дії завантаження минув. Попросіть автора оновити пропозицію.';
  }
  return fallback;
}

function remember(value: Proposal) {
  items.value = items.value.map((item) => (item.id === value.id ? value : item));
}

async function loadList(more = false) {
  if (more && cursor.value === null) return;
  loadingList.value = true;
  listError.value = '';
  try {
    const page = await api.list(props.projectId, more ? cursor.value! : undefined, lifetime.signal);
    if (lifetime.signal.aborted) return;
    items.value = more
      ? [
          ...items.value,
          ...page.items.filter((item) => !items.value.some(({ id }) => id === item.id)),
        ]
      : page.items;
    if (proposal.value) remember(proposal.value);
    cursor.value = page.nextCursor;
  } catch (error) {
    if (!lifetime.signal.aborted)
      listError.value = errorText(error, 'Не вдалося завантажити пропозиції.');
  } finally {
    if (!lifetime.signal.aborted) loadingList.value = false;
  }
}

function refreshReview() {
  void loadList();
  if (selectedId.value !== null) void loadDetail(selectedId.value);
}

function sameCandidate(
  value: { proposalId: number; candidateVersion: number; candidateManifestHash: string },
  current: Proposal,
) {
  return (
    value.proposalId === current.id &&
    value.candidateVersion === current.version &&
    value.candidateManifestHash === current.candidateManifestHash
  );
}

async function loadDetail(id: number | null, focus = false) {
  detailController?.abort();
  fileController?.abort();
  pollController?.abort();
  proposal.value = null;
  candidate.value = null;
  baseNumber.value = null;
  diff.value = null;
  annotations.value = new Map();
  annotationsLoading.value = false;
  annotationsError.value = '';
  validation.value = null;
  monitoring.value = false;
  pdf.value = null;
  pdfLoading.value = false;
  pdfError.value = '';
  showPdf.value = false;
  selectedFileId.value = null;
  fileText.value = null;
  fileLoading.value = false;
  fileError.value = '';
  downloading.value = false;
  downloadError.value = '';
  detailError.value = '';
  actionError.value = '';
  validationError.value = '';
  notice.value = '';
  decision.value = null;
  acknowledged.value = false;
  acceptAttempt = undefined;
  syncRevision.value = null;
  loadingDetail.value = id !== null;
  if (focus) {
    void nextTick(() => (id === null ? listFocus.value : detailFocus.value)?.focus());
    detailPane.value?.scrollTo(0, 0);
  }
  if (id === null) return;
  const controller = new AbortController();
  detailController = controller;
  const { signal } = controller;
  try {
    if (!validId(id)) throw new ApiError(404, 'NOT_FOUND', '', null);
    const item = await api.get(props.projectId, id, signal);
    const [changes, snapshot] = await Promise.all([
      api.diff(props.projectId, id, item.version, signal),
      api.candidate(props.projectId, id, item.version, signal),
    ]);
    if (signal.aborted) return;
    if (
      !sameCandidate(changes, item) ||
      !sameCandidate(snapshot, item) ||
      changes.baseRevisionId !== item.baseRevisionId ||
      snapshot.baseRevisionId !== item.baseRevisionId ||
      snapshot.candidateSnapshotId !== item.candidateSnapshotId ||
      JSON.stringify(changes.annotationOperations) !==
        JSON.stringify(
          snapshot.operations.filter(
            (op) => op.type === 'createAnnotation' || op.type === 'resolveAnnotation',
          ),
        )
    )
      throw new Error('Proposal candidate mismatch');
    proposal.value = item;
    candidate.value = snapshot;
    diff.value = changes;
    void loadAnnotations(item, changes, signal);
    remember(item);
    if (item.baseRevisionId === props.headId) baseNumber.value = props.headNumber;
    else
      void workspace
        .state(props.projectId, signal, item.baseRevisionId)
        .then((base) => {
          if (!signal.aborted) baseNumber.value = base.revision.number;
        })
        .catch(() => {});
    if (item.latestValidationId !== null && item.status === 'draft')
      void monitor(item, item.latestValidationId, signal);
  } catch (error) {
    if (!signal.aborted) detailError.value = errorText(error, 'Не вдалося завантажити зміни.');
  } finally {
    if (!signal.aborted) loadingDetail.value = false;
  }
}

async function loadAnnotations(item: Proposal, changes: ProposalDiff, signal: AbortSignal) {
  const ids = changes.annotationOperations.flatMap((op) =>
    op.type === 'resolveAnnotation' ? [op.annotationId] : [],
  );
  if (!ids.length) return;
  annotationsLoading.value = true;
  annotationsError.value = '';
  try {
    const result = await api.annotations(props.projectId, item.baseRevisionId, ids, signal);
    if (!signal.aborted) annotations.value = result;
  } catch {
    if (!signal.aborted) annotationsError.value = 'Не вдалося завантажити коментарі до пропозиції.';
  } finally {
    if (!signal.aborted) annotationsLoading.value = false;
  }
}

function delay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const timer = window.setTimeout(done, ms);
    function done() {
      window.clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    }
    signal.addEventListener('abort', done, { once: true });
    if (signal.aborted) done();
  });
}

async function monitor(
  item: Proposal,
  validationId: number,
  detailSignal: AbortSignal,
  initial?: ProposalValidation,
) {
  pollController?.abort();
  pollController = new AbortController();
  const signal = AbortSignal.any([detailSignal, pollController.signal]);
  validationError.value = '';
  validation.value = null;
  monitoring.value = true;
  const until = Date.now() + 120_000;
  try {
    let result = initial;
    let interval = 650;
    while (!signal.aborted) {
      result ??= await api.validation(props.projectId, item.id, validationId, signal);
      if (signal.aborted) return;
      if (result.id !== validationId || !sameCandidate(result, item))
        throw new Error('Proposal validation mismatch');
      validation.value = result;
      if (!waiting.value) return;
      if (Date.now() >= until) break;
      await delay(interval, signal);
      interval = Math.min(interval * 1.5, 5000);
      result = undefined;
    }
    if (!signal.aborted) validationError.value = 'Перевірка ще триває. Оновіть її стан.';
  } catch (error) {
    if (!signal.aborted)
      validationError.value = errorText(error, 'Не вдалося отримати результат перевірки.');
  } finally {
    if (!signal.aborted) monitoring.value = false;
  }
}

function retryMonitor() {
  const item = proposal.value;
  const signal = detailController?.signal;
  const id = validation.value?.id ?? item?.latestValidationId;
  if (item && signal && id) void monitor(item, id, signal);
}

async function runValidation() {
  const item = proposal.value;
  const signal = detailController?.signal;
  if (!item || !active.value || stale.value || busy.value || !signal) return;
  pollController?.abort();
  monitoring.value = false;
  validation.value = null;
  validationError.value = '';
  actionError.value = '';
  pdf.value = null;
  pdfError.value = '';
  showPdf.value = false;
  acceptAttempt = undefined;
  busy.value = true;
  try {
    const result = await api.validate(props.projectId, item, signal);
    if (!signal.aborted) {
      proposal.value = { ...item, latestValidationId: result.id };
      void monitor(item, result.id, signal, result);
    }
  } catch (error) {
    if (!signal.aborted) await recoverAction(error, 'Не вдалося запустити перевірку.');
  } finally {
    busy.value = false;
  }
}

async function openPdf() {
  const item = proposal.value;
  const result = validation.value;
  const signal = detailController?.signal;
  if (!item || !result?.compileJobId || !signal || result.status !== 'succeeded') return;
  showPdf.value = true;
  if (pdf.value || pdfLoading.value) return;
  pdfLoading.value = true;
  pdfError.value = '';
  try {
    const blob = await api.pdf(props.projectId, result.compileJobId, signal);
    if (!signal.aborted && validation.value?.id === result.id) pdf.value = blob;
  } catch (error) {
    if (!signal.aborted && validation.value?.id === result.id)
      pdfError.value = errorText(error, 'PDF недоступний. Повторіть перегляд або перевірку.');
  } finally {
    if (!signal.aborted) pdfLoading.value = false;
  }
}

async function selectFile(id: number) {
  fileController?.abort();
  selectedFileId.value = id;
  fileText.value = null;
  fileError.value = '';
  fileLoading.value = false;
  const item = proposal.value;
  const file = candidate.value?.tree.find(({ fileId }) => fileId === id);
  if (!item || file?.contentKind !== 'text') return;
  fileController = new AbortController();
  const { signal } = fileController;
  fileLoading.value = true;
  try {
    const text = await api.text(props.projectId, item.id, id, item.version, signal);
    if (text.sha256 !== file.sha256 || text.path !== file.path)
      throw new Error('Candidate file mismatch');
    if (!signal.aborted) fileText.value = text;
  } catch (error) {
    if (!signal.aborted) fileError.value = errorText(error, 'Не вдалося відкрити файл.');
  } finally {
    if (!signal.aborted) fileLoading.value = false;
  }
}

async function downloadOriginal(filename: string, read: (signal: AbortSignal) => Promise<Blob>) {
  const signal = detailController?.signal;
  if (!signal || downloading.value) return;
  downloading.value = true;
  downloadError.value = '';
  try {
    const blob = await read(signal);
    if (signal.aborted) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    if (!signal.aborted) downloadError.value = errorText(error, 'Не вдалося завантажити файл.');
  } finally {
    if (!signal.aborted) downloading.value = false;
  }
}

function downloadFile(id: number) {
  const item = proposal.value;
  const file = candidate.value?.tree.find(({ fileId }) => fileId === id);
  if (!item || !file) return;
  void downloadOriginal(file.path.split('/').at(-1)!, (signal) =>
    api.download(props.projectId, item.id, id, item.version, signal),
  );
}

function downloadMaterial(material: Material, side: 'before' | 'after') {
  const item = proposal.value;
  if (!item) return;
  void downloadOriginal(material.name, (signal) =>
    api.downloadMaterial(props.projectId, item, material, side, signal),
  );
}

function openDecision(kind: NonNullable<typeof decision.value>) {
  decision.value = kind;
  acknowledged.value = false;
}

async function recoverAction(error: unknown, fallback: string) {
  const id = proposal.value?.id;
  if (id && error instanceof ApiError && error.status === 409) {
    await loadDetail(id);
    actionError.value =
      error.code === 'REVISION_CONFLICT'
        ? 'Основний документ змінився. Перегляньте стан пропозиції ще раз.'
        : 'Стан пропозиції змінився. Перегляньте її ще раз.';
  } else actionError.value = errorText(error, fallback);
}

async function syncWorkspace() {
  if (syncRevision.value === null) return;
  try {
    await props.refreshAccepted(syncRevision.value);
    syncRevision.value = null;
  } catch {
    actionError.value = 'Пропозицію прийнято. Не вдалося оновити файли редактора.';
  }
}

async function retrySync() {
  busy.value = true;
  actionError.value = '';
  try {
    await syncWorkspace();
  } finally {
    busy.value = false;
  }
}

async function accept() {
  const item = proposal.value;
  const result = validation.value;
  const signal = detailController?.signal;
  if (!item || !result || !signal || !canAccept.value) return;
  const compileFailed = result.status === 'compile_failed';
  if (compileFailed && (!acknowledged.value || decision.value !== 'compile-error')) return;
  if (acceptAttempt?.validationId !== result.id)
    acceptAttempt = { validationId: result.id, key: crypto.randomUUID() };
  const { key } = acceptAttempt;
  busy.value = true;
  actionError.value = '';
  try {
    const accepted = await api.accept(props.projectId, item, result, compileFailed, key, signal);
    if (signal.aborted) return;
    proposal.value = { ...item, status: 'accepted', acceptedRevisionId: accepted.revisionId };
    remember(proposal.value);
    decision.value = null;
    acknowledged.value = false;
    notice.value =
      accepted.revisionId === item.baseRevisionId
        ? 'Пропозицію прийнято.'
        : `Пропозицію прийнято. Версія ${accepted.revisionNumber}.`;
    syncRevision.value = accepted.revisionNumber;
    await syncWorkspace();
  } catch (error) {
    if (!signal.aborted) {
      decision.value = null;
      acknowledged.value = false;
      await recoverAction(error, 'Не вдалося підтвердити прийняття. Повторіть спробу.');
    }
  } finally {
    busy.value = false;
  }
}

async function reject() {
  const item = proposal.value;
  const signal = detailController?.signal;
  if (!item || !signal || !active.value || busy.value) return;
  busy.value = true;
  actionError.value = '';
  try {
    const rejected = await api.reject(props.projectId, item, signal);
    if (signal.aborted) return;
    pollController?.abort();
    monitoring.value = false;
    proposal.value = rejected;
    remember(rejected);
    validation.value = null;
    pdf.value = null;
    showPdf.value = false;
    decision.value = null;
    notice.value = 'Пропозицію відхилено.';
  } catch (error) {
    if (!signal.aborted) {
      decision.value = null;
      await recoverAction(error, 'Не вдалося відхилити пропозицію.');
    }
  } finally {
    busy.value = false;
  }
}

async function rebase() {
  const item = proposal.value;
  const snapshot = candidate.value;
  const signal = detailController?.signal;
  if (!item || !snapshot || !signal || !stale.value || !props.canDecide || busy.value) return;
  busy.value = true;
  actionError.value = '';
  decision.value = null;
  try {
    const [base, head] = await Promise.all([
      workspace.state(props.projectId, signal, item.baseRevisionId),
      workspace.state(props.projectId, signal),
    ]);
    if (signal.aborted) return;
    const { operations } = snapshot;
    const currentFiles = new Map(head.tree.map((file) => [file.fileId, file]));
    const targetIds = new Set(
      operations.flatMap((op) => {
        if ('fileId' in op) return [op.fileId];
        return op.type === 'createAnnotation' ? [op.anchor.fileId] : [];
      }),
    );
    const materialIds = new Set(
      operations.flatMap((op) => ('materialId' in op ? [op.materialId] : [])),
    );
    const currentMaterials = new Map(
      head.materials.map((material) => [material.materialId, material]),
    );
    const folderOperation = operations.some((op) =>
      ['renameDirectory', 'deleteDirectory'].includes(op.type),
    );
    const touchesContext = operations.some((op) => op.type === 'updateContext');
    const changesOverlap =
      base.tree.length !== head.tree.length ||
      [...(base.directories ?? [])].sort().join('\n') !==
        [...(head.directories ?? [])].sort().join('\n') ||
      base.mainFileId !== head.mainFileId ||
      (touchesContext && base.contextText !== head.contextText) ||
      base.materials.some((previous) => {
        if (!materialIds.has(previous.materialId)) return false;
        const current = currentMaterials.get(previous.materialId);
        return (
          !current || current.versionId !== previous.versionId || current.name !== previous.name
        );
      }) ||
      base.tree.some((file) => {
        const current = currentFiles.get(file.fileId);
        return (
          !current ||
          file.path !== current.path ||
          ((folderOperation || targetIds.has(file.fileId)) && file.sha256 !== current.sha256)
        );
      });
    if (changesOverlap) {
      actionError.value =
        'Зміни можуть перетинатися. Попросіть автора оновити пропозицію на поточній версії.';
      return;
    }
    await api.rebase(
      props.projectId,
      item,
      {
        expectedProposalVersion: item.version,
        baseRevisionId: head.revision.id,
        summary: item.summary,
        operations,
      },
      signal,
    );
    if (!signal.aborted) {
      await loadDetail(item.id);
      if (proposal.value) notice.value = 'Базову версію оновлено. Перевірте зміни ще раз.';
    }
  } catch (error) {
    if (!signal.aborted) await recoverAction(error, 'Не вдалося оновити базову версію.');
  } finally {
    busy.value = false;
  }
}

function requestAccept() {
  if (validation.value?.status === 'compile_failed') openDecision('compile-error');
  else void accept();
}

watch(
  selectedId,
  (id, previous) => {
    if (previous === undefined || id === null) void loadList();
    void loadDetail(id, previous !== undefined);
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  lifetime.abort();
  detailController?.abort();
  fileController?.abort();
  pollController?.abort();
});
</script>

<template>
  <ModalDialog
    :open="true"
    title="ШІ-пропозиції"
    dialog-class="history-modal"
    :busy="busy"
    @dismiss="emit('dismiss')"
  >
    <button
      class="button button-quiet review-close"
      type="button"
      aria-label="Закрити пропозиції"
      :disabled="busy"
      @click="emit('dismiss')"
    >
      <svg aria-hidden="true" viewBox="0 0 20 20" width="20" height="20">
        <path d="m5 5 10 10M15 5 5 15" fill="none" stroke="currentColor" stroke-width="1.8" />
      </svg>
    </button>

    <div class="workspace-review-layout" :class="{ 'review-has-selection': selectedId !== null }">
      <nav class="review-list" aria-label="Список пропозицій">
        <header class="review-list-heading">
          <h3 ref="listFocus" tabindex="-1">Пропозиції</h3>
          <button
            class="button button-quiet"
            :disabled="loadingList || busy"
            @click="refreshReview"
          >
            Оновити
          </button>
        </header>
        <ul v-if="items.length">
          <li v-for="item in items" :key="item.id">
            <RouterLink
              :to="`${listPath}/${item.id}`"
              replace
              :aria-current="item.id === selectedId ? 'page' : undefined"
            >
              <strong>{{ item.summary }}</strong>
              <span
                >{{
                  item.status === 'draft' && item.isStale
                    ? 'База змінилася'
                    : statusLabels[item.status]
                }}
                · {{ date.format(new Date(item.createdAt)) }}</span
              >
            </RouterLink>
          </li>
        </ul>
        <p v-if="loadingList" class="muted" role="status">Завантаження пропозицій…</p>
        <div v-else-if="listError">
          <p class="field-error" role="alert">{{ listError }}</p>
          <button class="button button-secondary" @click="loadList()">Повторити</button>
        </div>
        <p v-else-if="!items.length" class="muted">У цьому проєкті ще немає пропозицій.</p>
        <button
          v-if="cursor !== null && !listError"
          class="button button-quiet"
          :disabled="loadingList"
          @click="loadList(true)"
        >
          Показати ще
        </button>
      </nav>

      <section v-if="selectedId !== null" class="review-detail" aria-label="Перегляд пропозиції">
        <div ref="detailPane" class="review-detail-body">
          <RouterLink :to="listPath" replace class="button button-quiet review-back"
            >← До пропозицій</RouterLink
          >
          <h3 v-if="!proposal" ref="detailFocus" tabindex="-1">Перегляд пропозиції</h3>
          <p v-if="loadingDetail" class="muted" role="status">Завантаження змін…</p>
          <div v-else-if="detailError">
            <p class="field-error" role="alert">{{ detailError }}</p>
            <button class="button button-secondary" @click="loadDetail(selectedId)">
              Повторити
            </button>
          </div>
          <template v-else-if="proposal && diff && candidate">
            <header class="review-heading">
              <h3 ref="detailFocus" tabindex="-1">{{ proposal.summary }}</h3>
              <p class="muted">
                {{ statusLabels[proposal.status] }} ·
                {{ proposal.channel === 'mcp' ? 'Зовнішній ШІ' : 'Вебзастосунок' }} · Версія
                пропозиції {{ proposal.version
                }}<template v-if="baseNumber !== null"> · Базова версія {{ baseNumber }}</template>
              </p>
            </header>
            <div v-if="stale" class="review-notice">
              <p>Основний документ змінився після створення цієї версії пропозиції.</p>
              <button
                class="button button-secondary"
                :disabled="busy || !canDecide"
                @click="openDecision('rebase')"
              >
                Оновити базу
              </button>
            </div>
            <section
              v-if="active || validation"
              class="review-validation"
              aria-label="Перевірка пропозиції"
            >
              <div class="review-actions">
                <span v-if="validation" class="muted" role="status">{{
                  validationLabels[validation.status]
                }}</span>
                <button
                  v-if="active && !stale && !monitoring && !waiting"
                  class="button button-secondary"
                  :disabled="busy"
                  @click="runValidation"
                >
                  {{ validation ? 'Перевірити ще раз' : 'Перевірити' }}
                </button>
                <button
                  v-if="validation?.status === 'succeeded'"
                  type="button"
                  class="button button-secondary"
                  :aria-expanded="showPdf"
                  @click="showPdf ? (showPdf = false) : openPdf()"
                >
                  {{ showPdf ? 'Закрити PDF' : 'Переглянути PDF' }}
                </button>
              </div>
              <div v-if="validationError" class="review-actions">
                <span class="field-error" role="alert">{{ validationError }}</span>
                <button class="button button-secondary" :disabled="busy" @click="retryMonitor">
                  Оновити стан перевірки
                </button>
              </div>
              <ul v-if="validation?.diagnostics.length" class="review-diagnostics">
                <li v-for="(entry, index) in validation.diagnostics" :key="index">
                  <strong>{{ entry.severity === 'error' ? 'Помилка' : 'Попередження' }}</strong>
                  <span v-if="entry.path"> · {{ diagnosticSource(entry) }}</span>
                  <p>{{ entry.message }}</p>
                </li>
              </ul>
              <template v-if="showPdf">
                <p v-if="pdfLoading" class="muted" role="status">Завантаження PDF…</p>
                <div v-if="pdfError" class="review-actions">
                  <p class="field-error" role="alert">{{ pdfError }}</p>
                  <button class="button button-secondary" @click="openPdf">Повторити</button>
                </div>
                <div v-if="pdf" class="review-pdf"><PdfDocument :pdf="pdf" /></div>
              </template>
            </section>
            <ReviewChanges
              :key="proposal.version"
              :diff="diff"
              :candidate="candidate"
              :selected-file-id="selectedFileId"
              :file-loading="fileLoading"
              :file-text="fileText"
              :file-error="fileError"
              :annotations="annotations"
              :annotations-loading="annotationsLoading"
              :annotations-error="annotationsError"
              :accepted="proposal.status === 'accepted'"
              :downloading="downloading"
              @select="selectFile"
              @download="downloadFile"
              @download-material="downloadMaterial"
              @retry-annotations="loadAnnotations(proposal, diff, detailController!.signal)"
            />
            <p
              v-if="active && annotationConflict && !annotationsLoading && !annotationsError"
              class="field-error"
              role="alert"
            >
              Коментар змінився або його видалено. Попросіть автора оновити пропозицію.
            </p>
            <p v-if="downloadError" class="field-error" role="alert">{{ downloadError }}</p>
          </template>
          <p v-if="actionError && !proposal" class="field-error" role="alert">{{ actionError }}</p>
        </div>
        <footer v-if="proposal && (active || notice || actionError)" class="review-decisions">
          <p v-if="active && !canDecide" class="muted">
            Збережіть правки в редакторі перед прийняттям або оновленням бази.
          </p>
          <p v-if="notice" role="status">{{ notice }}</p>
          <p v-if="actionError" class="field-error" role="alert">{{ actionError }}</p>
          <div class="review-actions">
            <button
              v-if="active && !stale"
              class="button button-primary"
              :disabled="!canAccept"
              @click="requestAccept"
            >
              Прийняти пропозицію
            </button>
            <button
              v-if="active"
              class="button button-secondary"
              :disabled="busy"
              @click="openDecision('reject')"
            >
              Відхилити
            </button>
            <button
              v-if="syncRevision !== null"
              class="button button-secondary"
              :disabled="busy"
              @click="retrySync"
            >
              Оновити файли редактора
            </button>
          </div>
        </footer>
      </section>
      <p v-else-if="items.length" class="review-placeholder muted">Виберіть пропозицію.</p>
    </div>

    <ModalDialog
      :open="decision !== null"
      :title="
        decision === 'reject'
          ? 'Відхилити пропозицію?'
          : decision === 'rebase'
            ? 'Оновити базову версію?'
            : 'Прийняти попри помилку Typst?'
      "
      :busy="busy"
      @dismiss="decision = null"
    >
      <template v-if="decision === 'compile-error'">
        <p>
          Запропоновані зміни не вдалося скомпілювати. Після прийняття документ потребуватиме
          виправлення.
        </p>
        <label class="review-check"
          ><input v-model="acknowledged" type="checkbox" /> Я розумію, що ці зміни містять помилку
          Typst.</label
        >
      </template>
      <p v-else-if="decision === 'reject'">
        Пропозицію буде закрито. Основний документ залишиться без змін.
      </p>
      <p v-else>
        Зміни буде перенесено на поточну версію, якщо їх можна застосувати без конфлікту. Після
        цього перегляньте зміни й запустіть нову перевірку.
      </p>
      <div class="modal-actions">
        <button class="button button-secondary" :disabled="busy" @click="decision = null">
          Скасувати
        </button>
        <button
          v-if="decision === 'reject'"
          class="button button-danger"
          :disabled="busy"
          @click="reject"
        >
          Відхилити пропозицію
        </button>
        <button
          v-else-if="decision === 'rebase'"
          class="button button-primary"
          :disabled="busy || !canDecide"
          @click="rebase"
        >
          Оновити базу
        </button>
        <button
          v-else
          class="button button-primary"
          :disabled="!acknowledged || !canAccept"
          @click="accept"
        >
          Прийняти попри помилку
        </button>
      </div>
    </ModalDialog>
  </ModalDialog>
</template>

<style scoped>
.review-close {
  position: absolute;
  top: 8px;
  right: 10px;
  display: grid;
  width: 40px;
  height: 40px;
  padding: 0;
  place-items: center;
}
.workspace-review-layout {
  display: grid;
  grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
  min-height: 0;
  flex: 1;
}
.review-list,
.review-detail-body {
  min-width: 0;
  overflow: auto;
  padding: 20px;
  overscroll-behavior: contain;
}
.review-list {
  background: var(--color-background);
  border-right: 1px solid var(--color-border);
}
.review-list h3,
.review-detail h3 {
  margin: 0 0 12px;
  font-size: 16px;
}
.review-list-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.review-list-heading h3 {
  margin: 0;
}
.review-list ul {
  margin: 0 0 10px;
  padding: 0;
  list-style: none;
}
.review-list li + li {
  margin-top: 4px;
}
.review-list a {
  display: grid;
  gap: 2px;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: var(--radius-control);
  overflow-wrap: anywhere;
}
.review-list a:hover,
.review-list a[aria-current='page'] {
  background: var(--color-surface);
  border-color: var(--color-border);
}
.review-list a span {
  color: var(--color-muted);
  font-size: 12px;
}
.review-detail {
  display: flex;
  min-height: 0;
  min-width: 0;
  flex-direction: column;
  overflow-wrap: anywhere;
}
.review-detail-body {
  flex: 1;
}
.review-placeholder {
  align-self: center;
  justify-self: center;
}
.review-back {
  display: none;
  margin: -4px 0 10px -10px;
}
.review-heading p,
.review-notice p,
.review-decisions p,
.review-diagnostics p,
.review-validation p {
  margin-bottom: 0;
}
.review-heading h3 {
  margin-bottom: 4px;
  font-size: 20px;
}
.review-heading,
.review-validation,
.review-notice,
.review-decisions {
  margin-bottom: 16px;
}
.review-notice,
.review-validation {
  display: grid;
  gap: 10px;
  justify-items: start;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-panel);
  background: var(--color-background);
}
.review-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.review-decisions {
  display: grid;
  flex-shrink: 0;
  gap: 8px;
  margin: 0;
  padding: 12px 20px;
  border-top: 1px solid var(--color-border);
}
.review-diagnostics {
  margin: 0;
  padding-inline-start: 22px;
}
.review-pdf {
  width: 100%;
  height: min(580px, 65dvh);
  min-height: 260px;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-panel);
}
.review-check {
  display: flex;
  gap: 8px;
  align-items: baseline;
}
@media (max-width: 720px) {
  .workspace-review-layout {
    display: flex;
  }
  .review-back {
    display: inline-flex;
  }
  .review-list,
  .review-detail {
    flex: 1;
  }
  .review-list,
  .review-detail-body,
  .review-decisions {
    padding: 12px 16px;
  }
  .review-list {
    border-right: 0;
  }
  .review-has-selection .review-list,
  .review-placeholder {
    display: none;
  }
}
</style>
