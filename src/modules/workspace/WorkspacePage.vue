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
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router';
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
import { parentFolder } from './file-path';
import { ApiError } from '../../shared/api/client';
import { matchesResourceType } from './resource-formats';
import { createCompilationApi, type Diagnostic } from './compilation-api';
import { compilationRetryLabels, createCompilationModel } from './compilation-model';
import { createHistoryApi } from './history-api';
import WorkspaceOutput from './WorkspaceOutput.vue';
import WorkspaceDiagnostics from './WorkspaceDiagnostics.vue';
import WorkspaceRestoreStatus from './WorkspaceRestoreStatus.vue';
import WorkspaceTabs from './WorkspaceTabs.vue';
import FileAddMenu from './FileAddMenu.vue';
import { openPdfTab } from './pdf-tab';
import './workspace.css';

const WorkspaceHistory = defineAsyncComponent(() => import('./WorkspaceHistory.vue'));
const route = useRoute();
const router = useRouter();
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
const restoreRetryLabel = computed(() =>
  restoreAttempt.value
    ? restoreAttempt.value.result
      ? 'Оновити файли'
      : 'Повторити відновлення'
    : undefined,
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
  return output.artifact ? 'Оновлення PDF…' : 'Підготовка PDF…';
});
type ViewMode = 'code' | 'split' | 'preview';
const splitQuery = window.matchMedia('(min-width: 1024px)');
const canSplit = ref(splitQuery.matches);
const viewMode = ref<ViewMode>(canSplit.value ? 'split' : 'code');
const pdfOpenError = ref('');
const restoreLocked = computed(() => restoring.value || !!restoreAttempt.value);
let workspaceLoaded = false;
const startupAttempted = ref(false);
let handledCompilationRevision = 0;
const canCompile = computed(
  () =>
    startupAttempted.value &&
    !historyOpen.value &&
    !restoreLocked.value &&
    state.status === 'clean' &&
    !atRisk.value &&
    !compilation.state.busy &&
    compilation.state.retry !== 'status',
);
const resourceApi = createResourceApi(identitySession.request);
const resourceController = new AbortController();
type TabId = number | 'context';
const tabIds = ref<TabId[]>([]);
const activeTab = ref<TabId | null>(null);
const contextOpen = computed(() => activeTab.value === 'context');
const hasFileTab = computed(() => typeof activeTab.value === 'number');
const contextInput = ref<HTMLTextAreaElement | null>(null);
type ResourceAction = { directory: string; path?: string; fileId?: number };
const resourceAction = ref<ResourceAction | null>(null);
const resourceBusy = ref(false);
const resourceUploading = ref(false);
const resourceError = ref('');
const resourceAttempted = ref(false);
const downloading = ref(false);
const downloadError = ref('');
let stagedResource: { file: File; upload: ProjectUpload } | null = null;
let deferredResource: ResourceAction | null = null;
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

function closeHistory() {
  if (router.options.history.state.back === workspacePath) router.back();
  else void router.replace(workspacePath);
}

watch(historyOpen, async (open) => {
  if (open) {
    mobileFilesVisible.value = false;
    if (resourceAction.value && !resourceBusy.value && !state.pending) dismissResource();
    if (fileAction.value && !submittingFileAction.value && !state.pending) dismissFileAction();
    void refreshHistoryHead();
  } else {
    if (!restoreLocked.value) restoreError.value = '';
    if (workspaceLoaded) initializeWorkspaceOutput();
    await nextTick();
    if (document.activeElement === document.body || document.activeElement?.id === 'main-content')
      document.getElementById('workspace-history-link')?.focus({ preventScroll: true });
  }
});

function startCompilation(revision: { id: number; number: number }) {
  handledCompilationRevision = state.compilationRevision;
  pdfOpenError.value = '';
  void compilation.start({ id: revision.id, number: revision.number });
}

function requestCompile() {
  const revision = state.snapshot?.revision;
  if (!revision || !canCompile.value) return;
  if (effectiveViewMode.value === 'code') viewMode.value = canSplit.value ? 'split' : 'preview';
  startCompilation(revision);
}

watch([() => state.compilationRevision, () => state.status, canCompile], () => {
  if (state.status === 'conflict') handledCompilationRevision = state.compilationRevision;
  if (!canCompile.value || state.compilationRevision === handledCompilationRevision) return;
  const revision = state.snapshot?.revision;
  if (!revision) return;
  // Startup can already have picked up this save while looking for the first PDF.
  if (compilation.state.job?.revisionId === revision.id) {
    handledCompilationRevision = state.compilationRevision;
    return;
  }
  startCompilation(revision);
});

async function openContext() {
  await activateTab('context');
  await nextTick();
  if (contextOpen.value && !isMobile.value) contextInput.value?.focus({ preventScroll: true });
}
function openResource(action: ResourceAction, trigger?: HTMLElement) {
  if (actionsDisabled.value || state.status === 'saving') return;
  resourceAttempted.value = false;
  model.pauseAutosave(true);
  stagedResource = null;
  resourceError.value = '';
  resourceFocus = fileDialogTrigger(trigger);
  if (isMobile.value && mobileFilesVisible.value) {
    deferredResource = action;
    mobileFilesVisible.value = false;
    return;
  }
  resourceAction.value = action;
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
      if (action.fileId === undefined) showCreatedFile();
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
      if (resourceAction.value?.fileId === undefined) showCreatedFile();
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
type FileAction =
  | { kind: 'create'; directory: string; fileId?: never }
  | { kind: 'rename' | 'delete' | 'entrypoint'; fileId: number };
const fileAction = ref<FileAction | null>(null);
const submittingFileAction = ref(false);
let fileActionFocus: HTMLElement | null = null;
let focusCreatedFile = false;
let deferredFileAction: FileAction | null = null;
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
function fileDialogTrigger(trigger?: HTMLElement) {
  if (isMobile.value) return document.querySelector<HTMLElement>('.editor-files-toggle');
  return trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
}
function openFileAction(action: FileAction, trigger?: HTMLElement) {
  if (actionsDisabled.value) return;
  focusCreatedFile = false;
  fileActionFocus = fileDialogTrigger(trigger);
  if (isMobile.value && mobileFilesVisible.value) {
    deferredFileAction = action;
    mobileFilesVisible.value = false;
  } else fileAction.value = action;
}
function openTreeAction(
  kind: 'rename' | 'delete' | 'entrypoint' | 'replace',
  fileId: number,
  trigger: HTMLElement,
) {
  const file = state.snapshot?.tree.find((entry) => entry.fileId === fileId);
  if (!file) return;
  if (kind !== 'replace') openFileAction({ kind, fileId }, trigger);
  else if (file.contentKind === 'binary')
    openResource({ directory: parentFolder(file.path), path: file.path, fileId }, trigger);
}
function fileDrawerClosed() {
  if (deferredResource) {
    resourceAction.value = deferredResource;
    deferredResource = null;
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
  if (focusCreatedFile && !isMobile.value) editor.value?.focus();
  else if (fileActionFocus?.isConnected) fileActionFocus.focus();
  else document.querySelector<HTMLElement>('.editor-files-toggle')?.focus();
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
    const saved = await model.mutate(operations);
    if (saved && action.kind === 'create') {
      showCreatedFile();
      focusCreatedFile = true;
    }
    if (saved || state.status === 'conflict') fileAction.value = null;
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
      if (fileAction.value?.kind === 'create') {
        showCreatedFile();
        focusCreatedFile = true;
      }
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
function canOpenDiagnostic(item: Diagnostic, revisionId: number) {
  return (
    !!item.path &&
    revisionId === state.snapshot?.revision.id &&
    !!state.snapshot?.tree.some(
      (file) =>
        file.fileId === item.fileId && file.path === item.path && file.contentKind === 'text',
    )
  );
}
async function openDiagnostic(item: Diagnostic, revisionId: number) {
  if (item.fileId === null || !canOpenDiagnostic(item, revisionId)) return;
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
const treeSelection = ref<number | string | null>(null);
const selectedTreeFile = computed(() =>
  typeof treeSelection.value === 'number' ? treeSelection.value : 0,
);
const selectedFolder = computed(() =>
  typeof treeSelection.value === 'string' ? treeSelection.value : null,
);
const creationDirectory = computed(() => {
  if (selectedFolder.value !== null) return selectedFolder.value;
  const file = state.snapshot?.tree.find((entry) => entry.fileId === selectedTreeFile.value);
  return file ? parentFolder(file.path) : '';
});
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
const emptyMainFileAction = ref<HTMLButtonElement | null>(null);
const dirtyIds = computed(() =>
  Object.entries(state.files)
    .filter(([, file]) => file.base !== file.content)
    .map(([id]) => Number(id)),
);
function viewportChanged(event: MediaQueryListEvent) {
  isMobile.value = event.matches;
  mobileFilesVisible.value = false;
}
const tabs = computed(() => {
  const files = new Map(state.snapshot?.tree.map((file) => [file.fileId, file]));
  return tabIds.value.flatMap(
    (id): { id: TabId; label: string; title?: string; dirty: boolean }[] => {
      if (id === 'context')
        return [
          { id, label: 'Контекст', dirty: state.contextText !== state.snapshot?.contextText },
        ];
      const file = files.get(id);
      if (!file) return [];
      return [
        {
          id,
          label: file.path.split('/').at(-1)!,
          title: file.path,
          dirty: dirtyIds.value.includes(id),
        },
      ];
    },
  );
});

function showTab(id: TabId) {
  if (!tabIds.value.includes(id)) tabIds.value = [...tabIds.value, id];
  activeTab.value = id;
}

function showCreatedFile() {
  const file = state.snapshot?.tree.find((entry) => entry.fileId === state.selectedId);
  if (!file) return;
  collapsedPaths.value = collapsedPaths.value.filter((path) => !file.path.startsWith(`${path}/`));
  treeSelection.value = file.fileId;
  showTab(file.fileId);
}

async function activateTab(id: TabId) {
  if (id !== 'context' && !state.snapshot?.tree.some((file) => file.fileId === id)) return;
  showTab(id);
  downloadError.value = '';
  if (id !== 'context' && (id !== state.selectedId || state.fileError)) await model.select(id);
}

function retainTabs(remaining: TabId[], replacement?: number) {
  const previous = tabIds.value;
  const focusWasInTabs = !!document.activeElement?.closest('.workspace-tabs');
  tabIds.value = remaining;
  const current = activeTab.value;
  if (current !== null && !remaining.includes(current)) {
    const next = previous.slice(previous.indexOf(current) + 1).find((id) => remaining.includes(id));
    const fallback = next ?? remaining.at(-1) ?? replacement;
    if (fallback === undefined) activeTab.value = null;
    else void activateTab(fallback);
  }
  if (focusWasInTabs)
    void nextTick(() => {
      const target = document.getElementById(`workspace-tab-${activeTab.value}`);
      (target ?? emptyMainFileAction.value)?.focus({ preventScroll: true });
    });
}

function closeTab(id: TabId) {
  retainTabs(tabIds.value.filter((tab) => tab !== id));
}
function closeOtherTabs(id: TabId) {
  retainTabs(tabIds.value.filter((tab) => tab === id));
}
function closeTabsToRight(id: TabId) {
  const index = tabIds.value.indexOf(id);
  if (index >= 0) retainTabs(tabIds.value.slice(0, index + 1));
}
function moveTab(id: TabId, index: number) {
  const from = tabIds.value.indexOf(id);
  if (from === index || from < 0 || index < 0 || index >= tabIds.value.length) return;
  const ordered = [...tabIds.value];
  ordered.splice(from, 1);
  ordered.splice(index, 0, id);
  tabIds.value = ordered;
}

watch(
  () => state.snapshot?.tree,
  (tree) => {
    if (!tree) return;
    const valid = new Set(tree.map((file) => file.fileId));
    const selection = treeSelection.value;
    if (
      (typeof selection === 'number' && !valid.has(selection)) ||
      (typeof selection === 'string' && !tree.some((file) => file.path.startsWith(`${selection}/`)))
    )
      treeSelection.value = null;
    const remaining = tabIds.value.filter((id) => id === 'context' || valid.has(id));
    if (remaining.length !== tabIds.value.length) {
      const replacement = valid.has(state.selectedId)
        ? state.selectedId
        : state.snapshot?.mainFileId;
      retainTabs(remaining, replacement);
    }
  },
);

async function selectFile(fileId: number) {
  if (onlyOutput.value) viewMode.value = canSplit.value ? 'split' : 'code';
  await activateTab(fileId);
  if (activeTab.value !== fileId) return;
  if (isMobile.value) mobileFilesVisible.value = false;
  else await nextTick(() => editor.value?.focus());
}
function selectTreeFile(fileId: number) {
  treeSelection.value = fileId;
  void selectFile(fileId);
}
async function openMainFile() {
  const id = state.snapshot?.mainFileId;
  if (id === undefined) return;
  await selectFile(id);
  if (isMobile.value && activeTab.value === id)
    document.getElementById(`workspace-tab-${id}`)?.focus({ preventScroll: true });
}
async function showFilesFromEmptyEditor() {
  filesVisible.value = true;
  if (!isMobile.value) {
    await nextTick();
    document.querySelector<HTMLElement>('#workspace-files .workspace-file-list button')?.focus();
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
  if (!startupAttempted.value) {
    startupAttempted.value = true;
    void compilation.openStartup();
  }
}
async function loadWorkspace() {
  await model.load(takeWorkspaceRecovery(ownerId, projectId));
  if (restoreController.signal.aborted || !state.snapshot || state.error) return;
  showTab(state.selectedId);
  workspaceLoaded = true;
  initializeWorkspaceOutput();
  if (historyOpen.value) void refreshHistoryHead();
}
onMounted(() => {
  mobileQuery.addEventListener('change', viewportChanged);
  splitQuery.addEventListener('change', splitChanged);
  void loadWorkspace();
});
onBeforeUnmount(() => {
  resourceController.abort();
  restoreController.abort();
  compilation.dispose();
  mobileQuery.removeEventListener('change', viewportChanged);
  splitQuery.removeEventListener('change', splitChanged);
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
      <div class="editor-heading" :class="{ 'editor-heading-commands': !state.conflict }">
        <button
          v-if="!state.conflict && !onlyOutput"
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
            v-if="!state.conflict && !onlyOutput"
            type="button"
            class="button button-quiet workspace-context-command"
            @click="openContext"
          >
            Контекст
          </button>
          <RouterLink
            v-if="!state.conflict"
            id="workspace-history-link"
            :to="`${workspacePath}/history`"
            class="file-icon-button workspace-history-link"
            aria-label="Історія версій"
            aria-haspopup="dialog"
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
        <div v-if="!state.conflict" class="workspace-command-bar">
          <button
            type="button"
            class="file-icon-button"
            title="Скомпілювати"
            aria-label="Скомпілювати"
            :disabled="!canCompile"
            @click="requestCompile"
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              aria-hidden="true"
            >
              <path
                d="M16 8a6 6 0 1 0 0 4m0-8v4h-4"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
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
            v-if="!showOutput && compilation.state.busy"
            class="workspace-compile-status"
            role="status"
            >{{ compileStatus }}</span
          >
        </div>
      </div>
      <p v-if="pdfOpenError && !historyOpen" class="editor-notice" role="alert">
        {{ pdfOpenError }}
      </p>
      <div
        v-if="!showOutput && !historyOpen && !state.conflict && compilation.state.error"
        class="editor-notice"
      >
        <p role="alert">{{ compilation.state.error }}</p>
        <button
          v-if="compilation.state.retry"
          type="button"
          class="button button-secondary"
          @click="compilation.retry"
        >
          {{ compilationRetryLabels[compilation.state.retry] }}
        </button>
      </div>
      <WorkspaceRestoreStatus
        v-if="!historyOpen || state.conflict"
        :error="restoreError"
        :notice="restoreNotice"
        :restoring="restoring"
        :retry-label="restoreRetryLabel"
        :retry-disabled="atRisk"
        @retry="retryRestore"
      />
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
        @dismiss="closeHistory"
        @restore="restoreVersion"
        @refresh="refreshHistoryHead"
      >
        <template v-if="restoreError || restoring || restoreNotice" #status>
          <WorkspaceRestoreStatus
            :error="restoreError"
            :notice="restoreNotice"
            :restoring="restoring"
            :retry-label="restoreRetryLabel"
            :retry-disabled="atRisk"
            @retry="retryRestore"
          />
        </template>
      </WorkspaceHistory>
      <div
        v-if="!state.conflict"
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
              @create="openFileAction({ kind: 'create', directory: creationDirectory })"
              @upload="openResource({ directory: creationDirectory })"
            />
          </div>
          <WorkspaceFiles
            :files="state.snapshot.tree"
            :selected-id="selectedTreeFile"
            :selected-folder="selectedFolder"
            :dirty-ids="dirtyIds"
            :collapsed-paths="collapsedPaths"
            :main-file-id="state.snapshot.mainFileId"
            :disabled="actionsDisabled"
            :replace-disabled="state.status === 'saving'"
            :mobile="false"
            @toggle="toggleFolder"
            @select="selectTreeFile"
            @select-folder="treeSelection = $event"
            @action="openTreeAction"
          />
        </aside>
        <section v-show="!onlyOutput" class="editor-source" aria-label="Редактор файла">
          <div v-if="activeTab !== null" class="editor-file-bar">
            <WorkspaceTabs
              :tabs="tabs"
              :active-id="activeTab"
              @select="activateTab"
              @close="closeTab"
              @close-others="closeOtherTabs"
              @close-right="closeTabsToRight"
              @close-all="retainTabs([])"
              @move="moveTab"
            />
          </div>
          <div
            id="workspace-tab-panel"
            class="workspace-tab-panel"
            :role="activeTab === null ? undefined : 'tabpanel'"
            :aria-labelledby="activeTab === null ? undefined : `workspace-tab-${activeTab}`"
          >
            <section v-show="contextOpen" class="workspace-context">
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
            <div v-if="activeTab === null" class="editor-empty">
              <div class="editor-empty-content">
                <h2>Немає відкритих файлів</h2>
                <div class="editor-empty-actions">
                  <button
                    ref="emptyMainFileAction"
                    type="button"
                    class="button button-secondary"
                    @click="openMainFile"
                  >
                    Відкрити головний файл
                  </button>
                  <button
                    v-if="isMobile || !filesVisible"
                    type="button"
                    class="button button-quiet"
                    :aria-haspopup="isMobile ? 'dialog' : undefined"
                    @click="showFilesFromEmptyEditor"
                  >
                    Вибрати файл
                  </button>
                </div>
              </div>
            </div>
            <p
              v-else-if="hasFileTab && state.fileLoading"
              role="status"
              class="editor-file-message"
            >
              Завантаження файла…
            </p>
            <div v-else-if="hasFileTab && state.fileError" role="alert" class="editor-file-message">
              <p>{{ state.fileError }}</p>
              <button class="button button-secondary" @click="model.select(state.selectedId)">
                Повторити завантаження
              </button>
            </div>
            <div
              v-else-if="hasFileTab && selectedMeta?.contentKind === 'binary'"
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
                hasFileTab &&
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
              @update:model-value="(value, fileId) => model.edit(fileId, value)"
              @save="model.save()"
              @composition="model.composition"
            />
          </div>
        </section>
        <WorkspaceOutput
          v-show="showOutput"
          :output="compilation.state"
          @retry="compilation.retry"
          @download="downloadPdf"
          @open="openPdf"
        />
      </div>
      <WorkspaceDiagnostics
        v-if="!state.conflict"
        :result="compilation.state.diagnostics"
        :can-open-file="canOpenDiagnostic"
        @source="openDiagnostic"
      />
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
            @create="openFileAction({ kind: 'create', directory: creationDirectory })"
            @upload="openResource({ directory: creationDirectory })"
          />
          <WorkspaceFiles
            :files="state.snapshot.tree"
            :selected-id="selectedTreeFile"
            :selected-folder="selectedFolder"
            :dirty-ids="dirtyIds"
            :collapsed-paths="collapsedPaths"
            :main-file-id="state.snapshot.mainFileId"
            :disabled="actionsDisabled"
            :replace-disabled="state.status === 'saving'"
            :mobile="true"
            @toggle="toggleFolder"
            @select="selectTreeFile"
            @select-folder="treeSelection = $event"
            @action="openTreeAction"
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
        :directory="resourceAction?.directory ?? ''"
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
    </template>
  </section>
</template>
