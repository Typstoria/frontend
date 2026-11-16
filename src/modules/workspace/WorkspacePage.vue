<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute } from 'vue-router';
import { identitySession } from '../identity/identity-session';
import { createResourceApi, createWorkspaceApi } from './workspace-api';
import { createWorkspaceModel, workspaceError } from './workspace-model';
import {
  registerWorkspaceExit,
  retainWorkspace,
  retainWorkspaceRestore,
  takeWorkspaceRecovery,
  takeWorkspaceRestore,
  type RestoreAttempt,
} from './workspace-lifecycle';
import TextEditor from './TextEditor.vue';
import WorkspaceFiles from './WorkspaceFiles.vue';
import ModalDialog from '../../shared/ui/ModalDialog.vue';
import FileActionDialog from './FileActionDialog.vue';
import ResourceDialog from './ResourceDialog.vue';
import type { ProjectUpload, StructureChange } from './workspace-api';
import { ApiError } from '../../shared/api/client';
import { matchesResourceType } from './resource-formats';
import { createCompilationApi, type Diagnostic } from './compilation-api';
import { createCompilationModel } from './compilation-model';
import { createHistoryApi } from './history-api';
import WorkspaceOutput from './WorkspaceOutput.vue';
import FileAddMenu from './FileAddMenu.vue';
import { openPdfTab } from './pdf-tab';
import './workspace.css';

const WorkspaceHistory = defineAsyncComponent(() => import('./WorkspaceHistory.vue'));
const route = useRoute();
const projectId = Number(route.params.projectId);
const ownerId = identitySession.user.value!.id;
const model = createWorkspaceModel(projectId, createWorkspaceApi(identitySession.request));
const { state, atRisk } = model;
const workspacePath = `/projects/${projectId}`;
const historyOpen = computed(() => route.params.workspaceView === 'history');
const historyApi = createHistoryApi(identitySession.request);
const restoreController = new AbortController();
const recoveredRestore = takeWorkspaceRestore(ownerId, projectId);
const restoreAttempt = ref<RestoreAttempt | null>(null);
const restoring = ref(false);
const refreshBusy = ref(false);
const restoreError = ref(
  recoveredRestore && !recoveredRestore.result
    ? 'Під час відновлення сеанс завершився. Перевірте результат в історії версій.'
    : '',
);
const restoreNotice = ref(
  recoveredRestore?.result ? `Створено версію ${recoveredRestore.result.revisionNumber}.` : '',
);
const canRestore = computed(
  () =>
    !!state.snapshot &&
    !atRisk.value &&
    state.status === 'clean' &&
    !restoreAttempt.value &&
    !refreshBusy.value,
);
const compilation = createCompilationModel(
  createCompilationApi(projectId, identitySession.request),
);
const compileStatus = computed(() => {
  const output = compilation.state;
  if (output.busy) return output.artifact ? 'Оновлення PDF…' : 'Підготовка PDF…';
  if (output.error) {
    if (output.retry === 'status') return 'Статус невідомий';
    if (output.job?.status === 'succeeded') return 'PDF недоступний';
    if (output.job?.status === 'cancelled') return 'Скасовано';
    return 'Компіляція не вдалася';
  }
  return '';
});
type ViewMode = 'code' | 'split' | 'preview';
const splitQuery = window.matchMedia('(min-width: 1024px)');
const canSplit = ref(splitQuery.matches);
const viewMode = ref<ViewMode>(canSplit.value ? 'split' : 'code');
const pdfOpenError = ref('');
const savingForCompile = ref(false);
const compileChoice = ref<{ id: number; number: number } | null>(null);
const compileError = ref('');
const restoreLocked = computed(() => restoring.value || !!restoreAttempt.value);
let workspaceLoaded = false;
let startupAttempted = false;
const resourceApi = createResourceApi(identitySession.request);
const resourceController = new AbortController();
const contextOpen = ref(false);
const contextInput = ref<HTMLTextAreaElement | null>(null);
const resourceAction = ref<{ path?: string; fileId?: number } | null>(null);
const resourceBusy = ref(false);
const resourceUploading = ref(false);
const resourceError = ref('');
const resourceAttempted = ref(false);
const downloading = ref(false);
const downloadError = ref('');
let stagedResource: { file: File; upload: ProjectUpload } | null = null;
let deferredResource = false;
let resourceFocus: HTMLElement | null = null;
let uploadController: AbortController | undefined;

async function refreshHistoryHead() {
  if (refreshBusy.value || !canRestore.value) return;
  refreshBusy.value = true;
  restoreError.value = '';
  try {
    await model.refreshHead();
  } catch (error) {
    if (!restoreController.signal.aborted)
      restoreError.value = workspaceError(error, 'Не вдалося оновити поточну версію.');
  } finally {
    refreshBusy.value = false;
  }
}

function restoreVersion(target: { id: number; number: number; expectedHeadId: number }) {
  if (!canRestore.value || state.snapshot?.revision.id !== target.expectedHeadId) return;
  restoreAttempt.value = {
    key: crypto.randomUUID(),
    body: {
      targetRevisionId: target.id,
      expectedCurrentRevisionId: target.expectedHeadId,
      summary: `Відновлено версію ${target.number}`,
    },
  };
  void retryRestore();
}

async function retryRestore() {
  const attempt = restoreAttempt.value;
  if (!attempt || restoring.value || !state.snapshot || atRisk.value) return;
  restoring.value = true;
  restoreError.value = '';
  restoreNotice.value = '';
  try {
    attempt.result ??= await historyApi.restore(
      projectId,
      attempt.body,
      attempt.key,
      restoreController.signal,
    );
    const head = await model.refreshHead();
    if (!head || head.revision.number < attempt.result.revisionNumber)
      throw new Error('Restore head is unavailable');
    restoreNotice.value = `Створено версію ${attempt.result.revisionNumber}.`;
    restoreAttempt.value = null;
  } catch (error) {
    if (restoreController.signal.aborted) return;
    if (!attempt.result && error instanceof ApiError && error.code === 'REVISION_CONFLICT') {
      restoreAttempt.value = null;
      await refreshHistoryHead();
      restoreError.value ||=
        'З’явилася новіша версія. Перегляньте зміни й підтвердьте відновлення ще раз.';
    } else if (
      !attempt.result &&
      error instanceof ApiError &&
      [400, 403, 404, 422].includes(error.status)
    ) {
      restoreAttempt.value = null;
      restoreError.value = workspaceError(error, 'Не вдалося відновити цю версію.');
    } else {
      restoreError.value = attempt.result
        ? 'Версію відновлено. Потрібно оновити файли проєкту.'
        : 'Не вдалося підтвердити відновлення. Повторіть спробу.';
    }
  } finally {
    restoring.value = false;
  }
}

watch(historyOpen, (open) => {
  if (open) {
    compileChoice.value = null;
    mobileFilesVisible.value = false;
    fileMenuOpen.value = false;
    if (resourceAction.value && !resourceBusy.value && !state.pending) dismissResource();
    if (fileAction.value && !submittingFileAction.value && !state.pending) dismissFileAction();
    void refreshHistoryHead();
  } else {
    if (!restoreLocked.value) restoreError.value = '';
    if (workspaceLoaded) initializeWorkspaceOutput();
  }
});

function requestCompile() {
  const revision = state.snapshot?.revision;
  if (!revision || compilation.state.busy || savingForCompile.value) return;
  compileError.value = '';
  if (atRisk.value || state.status !== 'clean')
    compileChoice.value = { id: revision.id, number: revision.number };
  else startCompilation(revision);
}

function startCompilation(revision: { id: number; number: number }) {
  if (compilation.state.busy || restoreLocked.value) return;
  if (effectiveViewMode.value === 'code') viewMode.value = canSplit.value ? 'split' : 'preview';
  pdfOpenError.value = '';
  compileChoice.value = null;
  compileError.value = '';
  void compilation.start({ id: revision.id, number: revision.number });
}

function compileSavedVersion() {
  if (compileChoice.value && !savingForCompile.value) startCompilation(compileChoice.value);
}

async function saveAndCompile() {
  if (
    !compileChoice.value ||
    savingForCompile.value ||
    compilation.state.busy ||
    restoreLocked.value
  )
    return;
  compileChoice.value = null;
  savingForCompile.value = true;
  try {
    if (state.pending) {
      await model.save();
      if (restoreController.signal.aborted) return;
      if (state.pending || state.saveError) {
        compileError.value = 'Спочатку збережіть зміни, а тоді повторіть компіляцію.';
        return;
      }
    }
    const before = state.snapshot?.revision.id;
    await model.save();
    if (restoreController.signal.aborted) return;
    if (
      state.snapshot &&
      !state.pending &&
      !state.saveError &&
      (state.status === 'clean' ||
        (state.status === 'dirty' && state.snapshot.revision.id !== before))
    )
      startCompilation(state.snapshot.revision);
    else compileError.value = 'Спочатку збережіть зміни, а тоді повторіть компіляцію.';
  } finally {
    savingForCompile.value = false;
  }
}

async function toggleContext() {
  contextOpen.value = !contextOpen.value;
  if (contextOpen.value) {
    await nextTick();
    if (!isMobile.value) contextInput.value?.focus();
  }
}
function openResource(replace: boolean) {
  if (actionsDisabled.value || state.status === 'saving') return;
  if (replace && selectedMeta.value?.contentKind !== 'binary') return;
  resourceAttempted.value = false;
  model.pauseAutosave(true);
  fileMenuOpen.value = false;
  stagedResource = null;
  resourceError.value = '';
  resourceFocus = replace
    ? fileMenuTrigger.value
    : isMobile.value
      ? document.querySelector<HTMLElement>('.editor-files-toggle')
      : (document.activeElement as HTMLElement | null);
  if (!replace && isMobile.value && mobileFilesVisible.value) {
    deferredResource = true;
    mobileFilesVisible.value = false;
    return;
  }
  if (!replace) resourceAction.value = {};
  else if (selectedMeta.value?.contentKind === 'binary')
    resourceAction.value = { path: selectedMeta.value.path, fileId: selectedMeta.value.fileId };
}
async function submitResource(input: { file: File; path: string }) {
  const action = resourceAction.value;
  if (
    !action ||
    resourceBusy.value ||
    state.pending ||
    ['saving', 'conflict'].includes(state.status)
  )
    return;
  resourceBusy.value = true;
  resourceError.value = '';
  try {
    if (
      stagedResource?.file !== input.file ||
      Date.parse(stagedResource.upload.expiresAt) <= Date.now()
    ) {
      uploadController = new AbortController();
      resourceUploading.value = true;
      const signal = AbortSignal.any([resourceController.signal, uploadController.signal]);
      const upload = await resourceApi.upload(projectId, input.file, signal);
      signal.throwIfAborted();
      resourceUploading.value = false;
      stagedResource = { file: input.file, upload };
    }
    const upload = stagedResource.upload;
    if (!matchesResourceType(input.path, upload.mediaType)) {
      resourceError.value = 'Розширення шляху має відповідати формату вибраного файла.';
      return;
    }
    const operation: StructureChange =
      action.fileId === undefined
        ? { type: 'attachFile', path: input.path, uploadId: upload.uploadId }
        : { type: 'replaceFile', fileId: action.fileId, uploadId: upload.uploadId };
    resourceAttempted.value = true;
    if (await model.mutate([operation])) {
      contextOpen.value = false;
      resourceAction.value = null;
    } else if (state.status === 'conflict') resourceAction.value = null;
    else if (!state.structure.length && !state.pending) stagedResource = null;
  } catch (error) {
    if (!resourceController.signal.aborted && !uploadController?.signal.aborted)
      resourceError.value =
        error instanceof ApiError && error.status === 415
          ? 'Формат або вміст файла не підтримується.'
          : error instanceof ApiError && error.status === 413
            ? 'Файл має бути не більшим за 10 МіБ.'
            : workspaceError(error, 'Не вдалося завантажити ресурс. Спробуйте ще раз.');
  } finally {
    uploadController = undefined;
    resourceUploading.value = false;
    resourceBusy.value = false;
  }
}
async function retryResource() {
  if (resourceBusy.value) return;
  resourceBusy.value = true;
  try {
    await model.save();
    if (state.status === 'conflict') resourceAction.value = null;
    else if (!state.pending && !state.structure.length && state.status !== 'failed') {
      contextOpen.value = false;
      resourceAction.value = null;
    } else if (!state.pending && !state.structure.length) stagedResource = null;
  } finally {
    resourceBusy.value = false;
  }
}
function dismissResource() {
  if (resourceBusy.value && !resourceUploading.value) return;
  uploadController?.abort();
  if (state.structure.some((op) => op.type === 'attachFile' || op.type === 'replaceFile'))
    model.cancelStructure();
  resourceAction.value = null;
}
function resourceClosed() {
  model.pauseAutosave(false);
  stagedResource = null;
  if (resourceFocus?.isConnected) resourceFocus.focus();
  resourceFocus = null;
}
async function downloadResource() {
  const file = selectedMeta.value;
  if (downloading.value || !state.snapshot || file?.contentKind !== 'binary') return;
  downloading.value = true;
  downloadError.value = '';
  try {
    const blob = await resourceApi.download(
      projectId,
      file,
      state.snapshot.revision.id,
      resourceController.signal,
    );
    resourceController.signal.throwIfAborted();
    downloadBlob(blob, file.path.split('/').at(-1)!);
  } catch (error) {
    if (!resourceController.signal.aborted && state.selectedId === file.fileId)
      downloadError.value = workspaceError(error, 'Не вдалося завантажити файл. Спробуйте ще раз.');
  } finally {
    downloading.value = false;
  }
}
type FileAction = { kind: 'create' | 'rename' | 'delete' | 'entrypoint'; fileId?: number };
const fileAction = ref<FileAction | null>(null);
const submittingFileAction = ref(false);
let fileActionFocus: HTMLElement | null = null;
let fileActionSucceeded = false;
let deferredFileAction: FileAction | null = null;
const fileMenuOpen = ref(false);
const fileMenuHost = ref<HTMLElement | null>(null);
const fileMenuTrigger = ref<HTMLButtonElement | null>(null);
const actionsDisabled = computed(
  () =>
    state.loading ||
    restoreLocked.value ||
    state.fileLoading ||
    state.conflictLoading ||
    state.status === 'conflict' ||
    state.structure.length > 0 ||
    (!!state.pending && state.status !== 'saving'),
);
function closeFileMenu(event: Event) {
  if (event.target instanceof Node && !fileMenuHost.value?.contains(event.target))
    fileMenuOpen.value = false;
}
async function toggleFileMenu() {
  fileMenuOpen.value = !fileMenuOpen.value;
  if (fileMenuOpen.value) {
    await nextTick();
    fileMenuHost.value?.querySelector<HTMLButtonElement>('[data-file-action]')?.focus();
  }
}
function escapeFileMenu() {
  fileMenuOpen.value = false;
  fileMenuTrigger.value?.focus();
}
function openFileAction(kind: FileAction['kind']) {
  if (actionsDisabled.value) return;
  fileActionSucceeded = false;
  fileActionFocus =
    kind === 'create'
      ? isMobile.value
        ? document.querySelector<HTMLElement>('.editor-files-toggle')
        : document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null
      : fileMenuTrigger.value;
  fileMenuOpen.value = false;
  const action: FileAction = kind === 'create' ? { kind } : { kind, fileId: state.selectedId };
  if (isMobile.value && mobileFilesVisible.value) {
    deferredFileAction = action;
    mobileFilesVisible.value = false;
  } else fileAction.value = action;
}
function fileDrawerClosed() {
  if (deferredResource) {
    deferredResource = false;
    resourceAction.value = {};
  }
  if (deferredFileAction) {
    fileAction.value = deferredFileAction;
    deferredFileAction = null;
  }
}
function dismissFileAction() {
  if (submittingFileAction.value || state.status === 'saving') return;
  model.cancelStructure();
  fileAction.value = null;
}
function fileActionClosed() {
  if (fileAction.value) return;
  if (fileActionSucceeded && !isMobile.value) editor.value?.focus();
  else if (fileActionFocus?.isConnected) fileActionFocus.focus();
  fileActionFocus = null;
}
async function submitFileAction(input: { path?: string; replacementId?: number }) {
  const action = fileAction.value;
  if (!action || submittingFileAction.value) return;
  const operations: StructureChange[] = [];
  if (action.kind === 'create' && input.path)
    operations.push({ type: 'createFile', path: input.path, content: '' });
  if (action.kind === 'rename' && action.fileId && input.path)
    operations.push({ type: 'renameFile', fileId: action.fileId, path: input.path });
  if (action.kind === 'delete' && action.fileId)
    operations.push({ type: 'deleteFile', fileId: action.fileId });
  const main = state.snapshot?.tree.find(
    (file) => file.fileId === (action.kind === 'entrypoint' ? action.fileId : input.replacementId),
  );
  if (main) operations.push({ type: 'setEntrypoint', path: main.path });
  if (!operations.length) return;
  submittingFileAction.value = true;
  try {
    fileActionSucceeded = await model.mutate(operations);
    if (fileActionSucceeded || state.status === 'conflict') fileAction.value = null;
  } finally {
    submittingFileAction.value = false;
  }
}
async function retryFileAction() {
  if (submittingFileAction.value) return;
  submittingFileAction.value = true;
  try {
    await model.save();
    if (!state.pending && !state.structure.length) {
      fileActionSucceeded = true;
      fileAction.value = null;
    } else if (state.status === 'conflict') fileAction.value = null;
  } finally {
    submittingFileAction.value = false;
  }
}
const mobileQuery = window.matchMedia('(max-width: 720px)');
const isMobile = ref(mobileQuery.matches);
const effectiveViewMode = computed<ViewMode>(() =>
  viewMode.value === 'split' && !canSplit.value ? 'code' : viewMode.value,
);
const onlyOutput = computed(() => effectiveViewMode.value === 'preview');
const showOutput = computed(() => effectiveViewMode.value !== 'code');
function splitChanged(event: MediaQueryListEvent) {
  canSplit.value = event.matches;
}
function canOpenDiagnostic(item: Diagnostic) {
  return (
    !!item.path &&
    compilation.state.job?.revisionId === state.snapshot?.revision.id &&
    !!state.snapshot?.tree.some(
      (file) =>
        file.fileId === item.fileId && file.path === item.path && file.contentKind === 'text',
    )
  );
}
async function openDiagnostic(item: Diagnostic) {
  if (item.fileId === null || !canOpenDiagnostic(item)) return;
  await selectFile(item.fileId);
  await nextTick();
  editor.value?.focus();
}
function openPdf(artifact: NonNullable<typeof compilation.state.artifact>) {
  pdfOpenError.value = '';
  if (Date.parse(artifact.job.artifactExpiresAt!) <= Date.now()) {
    pdfOpenError.value = 'PDF більше недоступний. Скомпілюйте документ ще раз.';
    return;
  }
  if (!openPdfTab(artifact.pdf))
    pdfOpenError.value =
      'Не вдалося відкрити PDF. Дозвольте відкриття нової вкладки й повторіть спробу.';
}
function downloadPdf(artifact: NonNullable<typeof compilation.state.artifact>) {
  if (Date.parse(artifact.job.artifactExpiresAt!) <= Date.now()) {
    pdfOpenError.value = 'PDF більше недоступний. Скомпілюйте документ ще раз.';
    return;
  }
  downloadBlob(artifact.pdf, `document-v${artifact.revision.number}.pdf`);
}
const desktopFilesVisible = ref(true);
const mobileFilesVisible = ref(false);
const collapsedPaths = ref<string[]>([]);
function toggleFolder(path: string) {
  collapsedPaths.value = collapsedPaths.value.includes(path)
    ? collapsedPaths.value.filter((p) => p !== path)
    : [...collapsedPaths.value, path];
}
const filesVisible = computed({
  get: () => (isMobile.value ? mobileFilesVisible.value : desktopFilesVisible.value),
  set: (value) => {
    if (isMobile.value) mobileFilesVisible.value = value;
    else desktopFilesVisible.value = value;
  },
});
const editor = ref<InstanceType<typeof TextEditor> | null>(null);
const dirtyIds = computed(() =>
  Object.entries(state.files)
    .filter(([, file]) => file.base !== file.content)
    .map(([id]) => Number(id)),
);
function viewportChanged(event: MediaQueryListEvent) {
  isMobile.value = event.matches;
  mobileFilesVisible.value = false;
}
async function selectFile(fileId: number) {
  if (onlyOutput.value) viewMode.value = canSplit.value ? 'split' : 'code';
  contextOpen.value = false;
  downloadError.value = '';
  fileMenuOpen.value = false;
  await model.select(fileId);
  if (isMobile.value) mobileFilesVisible.value = false;
  else {
    await nextTick();
    editor.value?.focus();
  }
}
const selectedMeta = computed(() =>
  state.snapshot?.tree.find((f) => f.fileId === state.selectedId),
);
const selected = computed(() => state.files[state.selectedId]);
const labels = {
  clean: 'Збережено',
  dirty: 'Незбережені зміни',
  saving: 'Збереження…',
  failed: 'Не збережено',
  outcome_unknown: 'Збереження не підтверджено',
  conflict: 'Потрібно узгодити зміни',
  refresh_failed: 'Не вдалося оновити файли',
};
let leaving = false;
const workspaceAtRisk = computed(
  () => atRisk.value || resourceUploading.value || restoreLocked.value,
);
function allowLeave() {
  if (!workspaceAtRisk.value || leaving) return true;
  const confirmed = window.confirm(
    restoreLocked.value
      ? 'Результат відновлення ще не підтверджено. Залишити проєкт?'
      : 'Є незбережені зміни або непідтверджене збереження. Якщо вийти, локальні правки буде втрачено. Залишити сторінку?',
  );
  if (confirmed) leaving = true;
  return confirmed;
}
const unregister = registerWorkspaceExit(allowLeave);
watch(
  workspaceAtRisk,
  (value) => {
    if (value) window.addEventListener('beforeunload', beforeUnload);
    else window.removeEventListener('beforeunload', beforeUnload);
  },
  { immediate: true },
);
onBeforeRouteLeave(() => !identitySession.user.value || allowLeave());
onBeforeRouteUpdate(
  (to, from) =>
    to.params.projectId === from.params.projectId || !identitySession.user.value || allowLeave(),
);
function beforeUnload(event: BeforeUnloadEvent) {
  if (!workspaceAtRisk.value) return;
  event.preventDefault();
  event.returnValue = '';
}
function downloadCopy() {
  const files = Object.entries(state.files).map(([id, file]) => ({
    path: state.snapshot?.tree.find((f) => f.fileId === Number(id))?.path,
    content: state.conflict?.files.find((f) => f.fileId === Number(id))?.merged ?? file.content,
  }));
  const blob = new Blob(
    [
      JSON.stringify(
        {
          title: state.snapshot?.project.title,
          files,
          comparisons: state.conflict?.files,
          context:
            state.conflict?.files.find((file) => file.fileId === null)?.merged ?? state.contextText,
          fileChanges: state.structure,
        },
        null,
        2,
      ),
    ],
    { type: 'application/json;charset=utf-8' },
  );
  downloadBlob(blob, `project-${projectId}-draft.json`);
}
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function initializeWorkspaceOutput() {
  if (historyOpen.value) return;
  if (!startupAttempted) {
    startupAttempted = true;
    void compilation.openStartup();
  }
}
async function loadWorkspace() {
  await model.load(takeWorkspaceRecovery(ownerId, projectId));
  if (restoreController.signal.aborted || !state.snapshot || state.error) return;
  workspaceLoaded = true;
  initializeWorkspaceOutput();
  if (historyOpen.value) void refreshHistoryHead();
}
onMounted(() => {
  mobileQuery.addEventListener('change', viewportChanged);
  splitQuery.addEventListener('change', splitChanged);
  document.addEventListener('pointerdown', closeFileMenu);
  void loadWorkspace();
});
onBeforeUnmount(() => {
  resourceController.abort();
  restoreController.abort();
  compilation.dispose();
  mobileQuery.removeEventListener('change', viewportChanged);
  splitQuery.removeEventListener('change', splitChanged);
  document.removeEventListener('pointerdown', closeFileMenu);
  if (!leaving && !identitySession.user.value) retainWorkspace(ownerId, projectId, model.recover());
  if (!leaving && restoreAttempt.value)
    retainWorkspaceRestore(ownerId, projectId, restoreAttempt.value);
  model.dispose();
  unregister();
  window.removeEventListener('beforeunload', beforeUnload);
});
</script>

<template>
  <section class="page editor-page" :aria-busy="state.loading">
    <div v-if="state.loading" class="editor-state" role="status">Завантаження проєкту…</div>
    <div v-else-if="state.error" class="editor-state" role="alert">
      <p>{{ state.error }}</p>
      <button class="button button-secondary" @click="loadWorkspace">Повторити</button>
    </div>
    <template v-else-if="state.snapshot">
      <div
        class="editor-heading"
        :class="{ 'editor-heading-commands': !historyOpen && !state.conflict }"
      >
        <button
          v-if="!state.conflict && !historyOpen && !onlyOutput"
          class="editor-files-toggle"
          :aria-expanded="filesVisible"
          :aria-controls="isMobile ? undefined : 'workspace-files'"
          :aria-label="filesVisible ? 'Приховати файли' : 'Показати файли'"
          :title="filesVisible ? 'Приховати файли' : 'Показати файли'"
          @click="filesVisible = !filesVisible"
        >
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            stroke-width="1.4"
            aria-hidden="true"
          >
            <rect x="2.5" y="3" width="15" height="14" rx="1.5" />
            <path d="M7 3v14" />
          </svg>
        </button>
        <h1 :title="state.snapshot.project.title">{{ state.snapshot.project.title }}</h1>
        <div class="editor-heading-tools">
          <span
            role="status"
            class="editor-save-status"
            :class="{ 'save-idle': state.status === 'clean' }"
            >{{ labels[state.status] }}</span
          >
          <button
            v-if="!state.conflict && !historyOpen && !onlyOutput"
            class="button button-quiet workspace-context-toggle"
            :aria-pressed="contextOpen"
            aria-controls="workspace-context"
            @click="toggleContext"
          >
            Контекст
          </button>
          <RouterLink
            v-if="historyOpen"
            :to="workspacePath"
            class="button button-quiet workspace-context-toggle"
            aria-label="Повернутися до редактора"
            title="Повернутися до редактора"
            >← До редактора</RouterLink
          >
          <RouterLink
            v-else-if="!state.conflict"
            :to="`${workspacePath}/history`"
            class="file-icon-button workspace-history-link"
            aria-label="Історія версій"
            title="Історія версій"
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              stroke-width="1.4"
              aria-hidden="true"
            >
              <path d="M3.4 8a7 7 0 1 1 .7 6.4M3 4.5V8h3.5m3.5-2v4l2.8 1.6" />
            </svg>
          </RouterLink>
        </div>
        <div v-if="!historyOpen && !state.conflict" class="workspace-command-bar">
          <button
            class="button button-primary compile-command"
            :disabled="
              restoreLocked ||
              compilation.state.busy ||
              savingForCompile ||
              state.status === 'conflict'
            "
            @click="requestCompile"
          >
            {{ savingForCompile ? 'Збереження…' : 'Скомпілювати' }}
          </button>
          <div class="workspace-view-modes" role="group" aria-label="Вигляд редактора">
            <button
              type="button"
              class="file-icon-button"
              title="Лише код"
              aria-label="Лише код"
              :aria-pressed="effectiveViewMode === 'code'"
              @click="viewMode = 'code'"
            >
              <svg
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                stroke-width="1.4"
                aria-hidden="true"
              >
                <rect x="2.5" y="3" width="15" height="14" rx="1.5" />
                <path d="m7.5 7-3 3 3 3m5-6 3 3-3 3" />
              </svg>
            </button>
            <button
              v-if="canSplit"
              type="button"
              class="file-icon-button"
              title="Код і PDF"
              aria-label="Код і PDF"
              :aria-pressed="effectiveViewMode === 'split'"
              @click="viewMode = 'split'"
            >
              <svg
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                stroke-width="1.4"
                aria-hidden="true"
              >
                <rect x="2.5" y="3" width="15" height="14" rx="1.5" />
                <path d="M10 3v14M5 7h2.5M5 10h2.5M12.5 7H15m-2.5 3H15m-2.5 3H15" />
              </svg>
            </button>
            <button
              type="button"
              class="file-icon-button"
              title="Лише PDF"
              aria-label="Лише PDF"
              :aria-pressed="effectiveViewMode === 'preview'"
              @click="viewMode = 'preview'"
            >
              <svg
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                stroke-width="1.4"
                aria-hidden="true"
              >
                <path d="M5 2.5h7l3 3v12H5zM12 2.5v4h3M8 10h4m-4 3h4" />
              </svg>
            </button>
          </div>
          <span
            v-if="!showOutput && compileStatus"
            class="workspace-compile-status"
            role="status"
            >{{ compileStatus }}</span
          >
        </div>
      </div>
      <p v-if="pdfOpenError && !historyOpen" class="editor-notice" role="alert">
        {{ pdfOpenError }}
      </p>
      <p v-if="compileError && !historyOpen" class="editor-notice" role="alert">
        {{ compileError }}
      </p>
      <div
        v-if="restoreError || restoring"
        class="editor-notice"
        :role="restoreError ? 'alert' : 'status'"
      >
        <p>{{ restoring ? 'Відновлення версії…' : restoreError }}</p>
        <button
          v-if="restoreAttempt && !restoring"
          class="button button-secondary"
          :disabled="atRisk"
          @click="retryRestore"
        >
          {{ restoreAttempt.result ? 'Оновити файли' : 'Повторити відновлення' }}
        </button>
      </div>
      <p v-else-if="restoreNotice" class="workspace-restore-notice" role="status">
        {{ restoreNotice }}
      </p>
      <div v-if="state.saveError && !state.conflict" class="editor-notice" role="alert">
        <div class="editor-notice-detail">
          <p>{{ state.saveError }}</p>
          <ul v-if="state.structureLabels.length">
            <li v-for="description in state.structureLabels" :key="description">
              {{ description }}
            </li>
          </ul>
        </div>
        <div class="editor-actions">
          <button
            v-if="state.status === 'conflict'"
            class="button button-secondary"
            :disabled="state.conflictLoading"
            @click="model.compare()"
          >
            {{ state.conflictLoading ? 'Завантаження…' : 'Порівняти версії' }}
          </button>
          <button
            v-else-if="atRisk"
            class="button button-secondary"
            :disabled="state.status === 'saving'"
            @click="model.save()"
          >
            {{ state.status === 'refresh_failed' ? 'Оновити файли' : 'Повторити збереження' }}
          </button>
          <button
            v-if="state.structure.length && state.status === 'failed' && !state.pending"
            class="button button-quiet"
            @click="model.cancelStructure()"
          >
            Скасувати зміну файлів
          </button>
          <button class="button button-quiet" @click="downloadCopy">Завантажити копію</button>
        </div>
      </div>
      <p v-if="state.conflictError" role="alert" class="editor-notice">{{ state.conflictError }}</p>
      <section v-if="state.conflict" class="editor-conflict" aria-labelledby="conflict-title">
        <div class="conflict-heading">
          <h2 id="conflict-title">Узгодження змін</h2>
          <p>Перевірте результат перед відновленням автозбереження.</p>
        </div>
        <section v-if="state.conflict.structure.length" class="conflict-file">
          <h3>Зміни файлів</h3>
          <div v-for="choice in state.conflict.structure" :key="choice.description">
            <p>{{ choice.description }}</p>
            <p v-if="choice.error" class="field-error">
              {{ choice.error }} Цю дію не буде повторено.
            </p>
            <label v-else class="conflict-choice"
              ><input
                v-model="choice.include"
                type="checkbox"
                :aria-label="`Повторити дію: ${choice.description}`"
              />Повторити цю дію після узгодження</label
            >
          </div>
        </section>
        <article
          v-for="file in state.conflict.files"
          :key="file.fileId ?? 'context'"
          class="conflict-file"
        >
          <h3>{{ file.path }}</h3>
          <div v-if="file.remote !== null" class="conflict-columns">
            <label
              >На сервері<textarea
                :aria-label="`Серверний текст: ${file.path}`"
                :value="file.remote"
                readonly
              />
            </label>
            <label
              >Ваш результат<textarea
                v-model="file.merged"
                :aria-label="`Об’єднаний текст: ${file.path}`"
                :disabled="file.useRemote"
              />
            </label>
          </div>
          <p v-else role="alert">
            Файл видалено або замінено на сервері. Завантажте копію, якщо потрібен локальний текст:
            продовження прибере його з редактора.
          </p>
          <label v-if="file.remote !== null" class="conflict-choice"
            ><input
              v-model="file.useRemote"
              type="checkbox"
              :aria-label="`Використати серверний текст: ${file.path}`"
            />Залишити серверну версію без моїх змін</label
          >
          <details class="conflict-originals">
            <summary>Початкові версії</summary>
            <div class="conflict-columns">
              <label
                >Базовий текст<textarea
                  :aria-label="`Базовий текст: ${file.path}`"
                  :value="file.base"
                  readonly
                />
              </label>
              <label
                >Ваші початкові зміни<textarea
                  :aria-label="`Локальний текст: ${file.path}`"
                  :value="file.local"
                  readonly
                />
              </label>
            </div>
          </details>
        </article>
        <div class="conflict-footer editor-actions">
          <button class="button button-primary" @click="model.resolve()">
            Продовжити автозбереження
          </button>
          <button class="button button-secondary" @click="downloadCopy">Завантажити копію</button>
        </div>
      </section>
      <WorkspaceHistory
        v-if="historyOpen && !state.conflict"
        :project-id="projectId"
        :head-id="state.snapshot.revision.id"
        :can-restore="canRestore"
        :busy="restoring"
        @restore="restoreVersion"
        @refresh="refreshHistoryHead"
      />
      <div
        v-if="!state.conflict"
        v-show="!historyOpen"
        class="editor-layout"
        :class="{
          'editor-without-files': isMobile || !filesVisible || onlyOutput,
          'editor-with-output': effectiveViewMode === 'split',
        }"
      >
        <aside
          v-if="!isMobile"
          v-show="filesVisible && !onlyOutput"
          id="workspace-files"
          class="editor-files"
          aria-label="Файли проєкту"
        >
          <div class="editor-files-heading">
            <h2>Файли</h2>
            <FileAddMenu
              :disabled="actionsDisabled"
              :upload-disabled="state.status === 'saving'"
              @create="openFileAction('create')"
              @upload="openResource(false)"
            />
          </div>
          <WorkspaceFiles
            :files="state.snapshot.tree"
            :selected-id="state.selectedId"
            :dirty-ids="dirtyIds"
            :collapsed-paths="collapsedPaths"
            :main-file-id="state.snapshot.mainFileId"
            @toggle="toggleFolder"
            @select="selectFile"
          />
        </aside>
        <section v-show="!onlyOutput" class="editor-source" aria-label="Редактор файла">
          <div v-show="!contextOpen" class="editor-file-bar">
            <h2>
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                stroke-width="1.2"
                aria-hidden="true"
              >
                <path d="M4 2h5l3 3v9H4zM9 2v4h3" /></svg
              ><span :title="selectedMeta?.path">{{ selectedMeta?.path }}</span
              ><span
                v-if="dirtyIds.includes(state.selectedId)"
                class="file-dirty"
                aria-label="Незбережені зміни"
                >●</span
              >
            </h2>
            <div
              ref="fileMenuHost"
              class="file-menu-host"
              @keydown.esc.stop.prevent="escapeFileMenu"
            >
              <button
                ref="fileMenuTrigger"
                class="file-icon-button"
                :aria-label="`Дії з файлом: ${selectedMeta?.path ?? ''}`"
                title="Дії з файлом"
                :aria-expanded="fileMenuOpen"
                :disabled="actionsDisabled || !selectedMeta"
                @click="toggleFileMenu"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <circle cx="4" cy="10" r="1.4" />
                  <circle cx="10" cy="10" r="1.4" />
                  <circle cx="16" cy="10" r="1.4" />
                </svg>
              </button>
              <div
                v-if="fileMenuOpen"
                class="file-action-list"
                role="group"
                aria-label="Дії з файлом"
              >
                <button data-file-action @click="openFileAction('rename')">
                  Перейменувати файл
                </button>
                <button
                  v-if="selectedMeta?.contentKind === 'binary'"
                  data-file-action
                  :disabled="state.status === 'saving'"
                  @click="openResource(true)"
                >
                  Замінити файл
                </button>
                <button
                  v-if="
                    selectedMeta?.contentKind === 'text' &&
                    selectedMeta.path.endsWith('.typ') &&
                    selectedMeta.fileId !== state.snapshot.mainFileId
                  "
                  data-file-action
                  @click="openFileAction('entrypoint')"
                >
                  Зробити головним
                </button>
                <button data-file-action class="danger-text" @click="openFileAction('delete')">
                  Видалити файл
                </button>
              </div>
            </div>
          </div>
          <section v-show="contextOpen" id="workspace-context" class="workspace-context">
            <label for="project-context-input">Контекст проєкту</label>
            <textarea
              id="project-context-input"
              ref="contextInput"
              :value="state.contextText"
              :readonly="state.conflictLoading || restoreLocked"
              placeholder="Вимоги, домовленості та примітки до документа"
              @input="model.editContext(($event.target as HTMLTextAreaElement).value)"
              @keydown.ctrl.s.prevent="model.save()"
              @keydown.meta.s.prevent="model.save()"
              @compositionstart="model.composition(true)"
              @compositionend="model.composition(false)"
              @blur="model.composition(false)"
            />
          </section>
          <p v-if="!contextOpen && state.fileLoading" role="status" class="editor-file-message">
            Завантаження файла…
          </p>
          <div v-else-if="!contextOpen && state.fileError" role="alert" class="editor-file-message">
            <p>{{ state.fileError }}</p>
            <button class="button button-secondary" @click="model.select(state.selectedId)">
              Повторити завантаження
            </button>
          </div>
          <div
            v-else-if="!contextOpen && selectedMeta?.contentKind === 'binary'"
            class="editor-file-message"
          >
            <p>Цей файл не містить редагованого тексту.</p>
            <button
              class="button button-secondary"
              :disabled="downloading"
              @click="downloadResource"
            >
              {{ downloading ? 'Скачуємо…' : 'Скачати файл' }}
            </button>
            <p v-if="downloadError" role="alert" class="field-error">{{ downloadError }}</p>
          </div>
          <TextEditor
            v-show="
              !contextOpen &&
              selected &&
              !state.fileLoading &&
              !state.fileError &&
              selectedMeta?.contentKind === 'text'
            "
            ref="editor"
            :document-id="selected ? state.selectedId : 0"
            :model-value="selected?.content ?? ''"
            :reset-key="state.resetKey"
            :readonly="
              restoreLocked ||
              state.conflictLoading ||
              state.structure.some(
                (operation) =>
                  operation.type === 'deleteFile' && operation.fileId === state.selectedId,
              )
            "
            @update:model-value="model.edit(state.selectedId, $event)"
            @save="model.save()"
            @composition="model.composition"
          />
        </section>
        <WorkspaceOutput
          v-show="showOutput"
          :output="compilation.state"
          :head-id="state.snapshot.revision.id"
          :unsaved="atRisk"
          :can-open-file="canOpenDiagnostic"
          @retry="compilation.retry"
          @source="openDiagnostic"
          @download="downloadPdf"
          @open="openPdf"
        />
      </div>
      <div class="mobile-files-modal">
        <ModalDialog
          :open="isMobile && mobileFilesVisible && !state.conflict"
          title="Файли"
          @dismiss="mobileFilesVisible = false"
          @closed="fileDrawerClosed"
        >
          <button
            class="drawer-close"
            aria-label="Закрити файли"
            @click="mobileFilesVisible = false"
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              aria-hidden="true"
            >
              <path d="m5 5 10 10M15 5 5 15" />
            </svg>
          </button>
          <FileAddMenu
            class="drawer-add"
            :disabled="actionsDisabled"
            :upload-disabled="state.status === 'saving'"
            @create="openFileAction('create')"
            @upload="openResource(false)"
          />
          <WorkspaceFiles
            :files="state.snapshot.tree"
            :selected-id="state.selectedId"
            :dirty-ids="dirtyIds"
            :collapsed-paths="collapsedPaths"
            :main-file-id="state.snapshot.mainFileId"
            @toggle="toggleFolder"
            @select="selectFile"
          />
        </ModalDialog>
      </div>
      <FileActionDialog
        :open="!!fileAction"
        :action="fileAction"
        :files="state.snapshot.tree"
        :main-file-id="state.snapshot.mainFileId"
        :dirty="!!fileAction?.fileId && dirtyIds.includes(fileAction.fileId)"
        :busy="submittingFileAction || state.status === 'saving'"
        :locked="!!state.pending && state.status !== 'saving'"
        :error="state.saveError"
        @submit="submitFileAction"
        @retry="retryFileAction"
        @dismiss="dismissFileAction"
        @closed="fileActionClosed"
      />
      <ResourceDialog
        :open="!!resourceAction"
        :replacement-path="resourceAction?.path"
        :files="state.snapshot.tree"
        :busy="resourceBusy || state.status === 'saving'"
        :uploading="resourceUploading"
        :locked="resourceAttempted && !!state.pending && state.status !== 'saving'"
        :error="resourceError || (resourceAttempted ? state.saveError : '')"
        @submit="submitResource"
        @retry="retryResource"
        @dismiss="dismissResource"
        @closed="resourceClosed"
      />
      <ModalDialog
        :open="!!compileChoice"
        title="Скомпілювати документ"
        @dismiss="compileChoice = null"
      >
        <p>У редакторі є зміни. Яку версію скомпілювати?</p>
        <div class="editor-actions compile-options">
          <button
            class="button button-primary"
            :disabled="state.status === 'conflict'"
            @click="saveAndCompile"
          >
            Зберегти й скомпілювати
          </button>
          <button v-if="compileChoice" class="button button-secondary" @click="compileSavedVersion">
            Скомпілювати версію {{ compileChoice.number }}
          </button>
          <button class="button button-quiet" @click="compileChoice = null">Скасувати</button>
        </div>
      </ModalDialog>
    </template>
  </section>
</template>
