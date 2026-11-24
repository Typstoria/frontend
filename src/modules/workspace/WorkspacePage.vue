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
import { createResourceApi, createWorkspaceApi, isMaterialChange } from './workspace-api';
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
import WorkspaceMaterials from './WorkspaceMaterials.vue';
import WorkspaceComments from './WorkspaceComments.vue';
import type { CommentLayout } from './comment-layout';
import type { Annotation, TextAnchor } from './annotation-api';
import { createTextAnchor, editorSelection, type TextSelection } from './text-anchor';
import type { Material } from './material-metadata';
import WorkspaceFiles from './WorkspaceFiles.vue';
import ModalDialog from '../../shared/ui/ModalDialog.vue';
import LoadError from '../../shared/ui/LoadError.vue';
import FileActionDialog, { type WorkspaceFileAction } from './FileActionDialog.vue';
import ResourceDialog from './ResourceDialog.vue';
import type { MaterialChange, ProjectUpload, StructureChange } from './workspace-api';
import {
  fileNameError,
  filePathInFolder,
  inFolder,
  parentFolder,
  projectFolders,
} from './file-path';
import { structureError } from './file-structure';
import { ApiError } from '../../shared/api/client';
import { matchesResourceType } from './resource-formats';
import { isTextUpload, readTextUpload } from './text-upload';
import { createCompilationApi, type Diagnostic } from './compilation-api';
import { compilationRetryLabels, createCompilationModel } from './compilation-model';
import { createHistoryApi } from './history-api';
import WorkspaceOutput from './WorkspaceOutput.vue';
import WorkspaceDiagnostics from './WorkspaceDiagnostics.vue';
import WorkspaceOutline from './WorkspaceOutline.vue';
import type { OutlineNavigation } from './workspace-outline';
import type { Position } from './compilation-diagnostics';
import {
  createLanguageSession,
  languageToolsAvailable,
  type EditorBuffers,
  type LanguageMethod,
} from './editor-language-session';
import { readDefinitions } from './editor-language-results';
import type { Snapshot } from './workspace-api';
import { downloadBlob } from '../../shared/files/download';
import WorkspaceSeparator from './WorkspaceSeparator.vue';
import WorkspaceRestoreStatus from './WorkspaceRestoreStatus.vue';
import WorkspaceTabs from './WorkspaceTabs.vue';
import FileAddMenu from './FileAddMenu.vue';
import ProjectTransferDialog from '../templates/ProjectTransferDialog.vue';
import WorkspaceMainMenu, { type WorkspaceMainMenuGroup } from './WorkspaceMainMenu.vue';
import { createProjectsApi, titleError } from '../projects/projects-api';
import { openPdfTab } from './pdf-tab';
import { createLivePreview, type PreviewInput } from './live-preview';
import type { PdfView } from './pdf-layout';
import {
  createWorkspacePreferences,
  defaultPanelSizes,
  type PanelSizes,
  type TabId,
  type ViewMode,
} from './workspace-preferences';
import './workspace.css';

const WorkspaceHistory = defineAsyncComponent(() => import('./WorkspaceHistory.vue'));
const WorkspaceReview = defineAsyncComponent(() => import('../review/WorkspaceReview.vue'));
const route = useRoute();
const router = useRouter();
const projectId = Number(route.params.projectId);
const ownerId = identitySession.user.value!.id;
const preferences = createWorkspacePreferences(ownerId, projectId);
const panelSizes = ref<PanelSizes>(preferences.panels);
const preferredMode = ref(preferences.project.mode);
const pdfView = ref<PdfView | undefined>(preferences.project.pdf);
const preferencesReady = ref(false);
const workspaceApi = createWorkspaceApi(identitySession.request);
const model = createWorkspaceModel(projectId, workspaceApi);
const { state, atRisk } = model;
const materialChangePending = computed(() => state.structure.some(isMaterialChange));
const commentsOpen = ref(false);
const commentsDirty = ref(false);
const commentsPanel = ref<InstanceType<typeof WorkspaceComments> | null>(null);
const commentLayout = ref<CommentLayout | null>(null);
const activeAnnotation = ref<number | null>(null);
const commentsTrigger = ref<HTMLButtonElement | null>(null);
const annotations = ref<Annotation[]>([]);
const textSelection = ref<(TextSelection & { fileId: number }) | null>(null);
const workspacePath = `/projects/${projectId}`;
const historyOpen = computed(() => route.params.workspaceView === 'history');
const reviewOpen = computed(() => route.params.workspaceView === 'proposals');
const reviewBusy = ref(false);
const reviewRevisionToRefresh = ref<number | null>(null);
const reviewRefreshing = ref(false);
const reviewRevisionToCompile = ref<number | null>(null);
function closeReview() {
  if (reviewBusy.value) return;
  if (router.options.history.state.back === workspacePath) router.back();
  else void router.replace(workspacePath);
}
async function refreshAfterReview(revisionNumber: number) {
  reviewRevisionToRefresh.value = revisionNumber;
  reviewRefreshing.value = true;
  try {
    const previous = state.snapshot?.revision.id;
    const head = await model.refreshHead();
    if (!head || head.revision.number < revisionNumber)
      throw new Error('Accepted revision unavailable');
    if (head.revision.id !== previous) reviewRevisionToCompile.value = head.revision.id;
    reviewRevisionToRefresh.value = null;
  } finally {
    reviewRefreshing.value = false;
  }
}
function retryReviewRefresh() {
  const revision = reviewRevisionToRefresh.value;
  if (revision !== null && !reviewRefreshing.value)
    void refreshAfterReview(revision).catch(() => {});
}
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
const splitQuery = window.matchMedia('(min-width: 1024px)');
const canSplit = ref(splitQuery.matches);
const sideComments = computed(() => canSplit.value && commentsOpen.value && !state.conflict);
const viewMode = computed<ViewMode>({
  get: () => preferredMode.value ?? (canSplit.value ? 'split' : 'code'),
  set: (mode) => (preferredMode.value = mode === 'split' ? undefined : mode),
});
const pdfOpenError = ref('');
const restoreLocked = computed(() => restoring.value || !!restoreAttempt.value);
let workspaceLoaded = false;
const startupAttempted = ref(false);
let handledCompilationRevision = 0;
const canCompile = computed(
  () =>
    startupAttempted.value &&
    !historyOpen.value &&
    !reviewOpen.value &&
    reviewRevisionToRefresh.value === null &&
    !restoreLocked.value &&
    state.status === 'clean' &&
    !atRisk.value &&
    !compilation.state.busy &&
    compilation.state.retry !== 'status',
);
const resourceApi = createResourceApi(identitySession.request);
const livePreview = createLivePreview(projectId, workspaceApi, resourceApi);
const liveDocument = livePreview.document;
const livePreviewSupported =
  import.meta.env.VITE_WORKSPACE_LIVE_PREVIEW !== 'false' &&
  typeof Worker !== 'undefined' &&
  typeof WebAssembly !== 'undefined';
const previewEdited = ref(false);
const hasDraftText = computed(() =>
  Object.values(state.files).some((file) => file.base !== file.content),
);
watch(hasDraftText, (dirty) => {
  if (dirty) previewEdited.value = true;
});
const resourceController = new AbortController();
const tabIds = ref<TabId[]>([]);
const activeTab = ref<TabId | null>(null);
const contextOpen = computed(() => activeTab.value === 'context');
const hasFileTab = computed(() => typeof activeTab.value === 'number');
const contextInput = ref<HTMLTextAreaElement | null>(null);
const workspaceHeading = ref<HTMLHeadingElement | null>(null);
const workspaceLoadError = ref<InstanceType<typeof LoadError> | null>(null);
type ResourceAction = { directory: string; path?: string; fileId?: number; files?: File[] };
const resourceAction = ref<ResourceAction | null>(null);
const resourceBusy = ref(false);
const resourceUploading = ref(false);
const resourceError = ref('');
const resourceAttempted = ref(false);
const treeDropError = ref('');
const downloading = ref(false);
const downloadError = ref('');
const stagedResources = new Map<File, ProjectUpload>();
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
  const reviewed = state.snapshot?.revision;
  if (reviewRevisionToCompile.value !== null && canCompile.value) {
    reviewRevisionToCompile.value = null;
    if (reviewed && compilation.state.job?.revisionId !== reviewed.id) {
      startCompilation(reviewed);
      return;
    }
  }
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
  if (onlyOutput.value) viewMode.value = canSplit.value ? 'split' : 'code';
  await activateTab('context');
  await nextTick();
  if (contextOpen.value && !isMobile.value) contextInput.value?.focus({ preventScroll: true });
}
function openResource(action: ResourceAction, trigger?: HTMLElement) {
  if (actionsDisabled.value || state.status === 'saving') return;
  treeDropError.value = '';
  resourceAttempted.value = false;
  model.pauseAutosave(true);
  stagedResources.clear();
  resourceError.value = '';
  resourceFocus = fileDialogTrigger(trigger);
  if (isMobile.value && mobileFilesVisible.value) {
    deferredResource = action;
    mobileFilesVisible.value = false;
    return;
  }
  resourceAction.value = action;
}
const diagnosticsOpen = ref(false);
const outlineOpen = ref(false);
const outlineDrafts = computed(
  () =>
    new Map(
      Object.entries(state.files)
        .filter(([, file]) => file.content !== file.base)
        .map(([id, file]) => [Number(id), file.content]),
    ),
);
const projectsApi = createProjectsApi(identitySession.request);
const transfer = ref<{
  mode: 'template' | 'export';
  revisionId: number;
  revisionNumber: number;
  hasUnsavedChanges: boolean;
} | null>(null);
const projectAction = ref<'rename' | 'delete' | null>(null);
const projectTitle = ref('');
const projectActionBusy = ref(false);
const projectActionError = ref('');
const projectTitleError = ref('');
const menuGroups = computed<WorkspaceMainMenuGroup[]>(() => [
  {
    label: 'Файл',
    items: [
      { id: 'new-file', label: 'Створити файл', disabled: actionsDisabled.value },
      { id: 'new-folder', label: 'Створити папку', disabled: actionsDisabled.value },
      { id: 'upload', label: 'Завантажити файл…', disabled: actionsDisabled.value },
      ...(languageEnabled.value
        ? [
            { id: 'complete', label: 'Підказки Typst', separatorBefore: true },
            { id: 'formatting', label: 'Форматувати файл', disabled: languageBusy.value },
            { id: 'definition', label: 'Перейти до визначення', disabled: languageBusy.value },
          ]
        : []),
      ...(compilation.state.artifact
        ? [{ id: 'download-pdf', label: 'Завантажити PDF', separatorBefore: true }]
        : []),
    ],
  },
  {
    label: 'Вигляд',
    items: [
      {
        id: 'files',
        label: 'Панель файлів',
        checked: filesVisible.value && !onlyOutput.value,
        disabled: !!inlineName.value,
      },
      {
        id: 'code',
        label: 'Лише код',
        checked: effectiveViewMode.value === 'code',
        separatorBefore: true,
      },
      ...(canSplit.value
        ? [{ id: 'split', label: 'Код і PDF', checked: effectiveViewMode.value === 'split' }]
        : []),
      {
        id: 'preview',
        label: 'Лише PDF',
        checked: effectiveViewMode.value === 'preview',
        disabled: !!inlineName.value,
      },
      {
        id: 'outline',
        label: 'Структура документа…',
        separatorBefore: true,
        disabled: !!inlineName.value,
      },
      ...(displayDiagnostics.value?.items.length
        ? [
            {
              id: 'diagnostics',
              label: 'Діагностика',
              checked: diagnosticsOpen.value,
            },
          ]
        : []),
      ...(layoutCustomized.value
        ? [{ id: 'reset-layout', label: 'Скинути розкладку', separatorBefore: true }]
        : []),
    ],
  },
  {
    label: 'Проєкт',
    items: [
      { id: 'context', label: 'Контекст' },
      { id: 'history', label: 'Історія версій' },
      { id: 'proposals', label: 'ШІ-пропозиції' },
      {
        id: 'save-template',
        label: 'Зберегти як шаблон…',
        separatorBefore: true,
        disabled: !state.snapshot,
      },
      { id: 'export-zip', label: 'Експортувати ZIP…', disabled: !state.snapshot },
      {
        id: 'rename-project',
        label: 'Перейменувати проєкт…',
        separatorBefore: true,
        disabled: !!fileAction.value || restoreLocked.value,
      },
      {
        id: 'delete-project',
        label: 'Видалити проєкт…',
        danger: true,
        disabled: !!fileAction.value || restoreLocked.value,
      },
    ],
  },
]);

function runWorkspaceCommand(id: string, trigger: HTMLElement) {
  trigger.focus({ preventScroll: true });
  if (id === 'new-file' || id === 'new-folder') {
    openFileAction(
      {
        kind: id === 'new-file' ? 'create' : 'createDirectory',
        directory: creationDirectory.value,
      },
      trigger,
    );
  } else if (id === 'upload') openResource({ directory: creationDirectory.value }, trigger);
  else if (id === 'complete') editor.value?.showCompletions();
  else if (id === 'formatting' || id === 'definition') void runLanguageCommand(id);
  else if (id === 'download-pdf' && compilation.state.artifact)
    downloadPdf(compilation.state.artifact);
  else if (id === 'files') {
    if (onlyOutput.value) viewMode.value = canSplit.value ? 'split' : 'code';
    else if (filesVisible.value) {
      filesVisible.value = false;
      return;
    }
    filesVisible.value = true;
  } else if (id === 'code' || id === 'split' || id === 'preview') viewMode.value = id;
  else if (id === 'outline') outlineOpen.value = true;
  else if (id === 'diagnostics') diagnosticsOpen.value = !diagnosticsOpen.value;
  else if (id === 'reset-layout') resetLayout();
  else if (id === 'context') void openContext();
  else if (id === 'history') void router.push(`${workspacePath}/history`);
  else if (id === 'proposals') void router.push(`${workspacePath}/proposals`);
  else if (id === 'save-template' || id === 'export-zip') {
    const snapshot = state.snapshot;
    if (!snapshot) return;
    transfer.value = {
      mode: id === 'save-template' ? 'template' : 'export',
      revisionId: snapshot.revision.id,
      revisionNumber: snapshot.revision.number,
      hasUnsavedChanges:
        hasDraftText.value || state.contextText !== snapshot.contextText || !!state.pending,
    };
  } else if (id === 'rename-project' || id === 'delete-project') {
    projectTitle.value = state.snapshot?.project.title ?? '';
    projectTitleError.value = '';
    projectActionError.value = '';
    projectAction.value = id === 'rename-project' ? 'rename' : 'delete';
    model.pauseAutosave(true);
  }
}

function dismissProjectAction() {
  if (projectActionBusy.value) return;
  model.pauseAutosave(false);
  projectAction.value = null;
}

async function submitProjectAction() {
  const action = projectAction.value;
  if (!action || projectActionBusy.value || state.status === 'saving') return;
  if (action === 'rename') {
    projectTitleError.value = titleError(projectTitle.value);
    if (projectTitleError.value) {
      document.getElementById('workspace-project-title')?.focus();
      return;
    }
    if (projectTitle.value.trim() === state.snapshot?.project.title) {
      dismissProjectAction();
      return;
    }
  }
  projectActionError.value = '';
  projectActionBusy.value = true;
  const signal = resourceController.signal;
  try {
    if (action === 'rename') {
      const project = await projectsApi.rename(projectId, projectTitle.value, signal);
      if (signal.aborted || !state.snapshot) return;
      state.snapshot.project.title = project.title;
      state.snapshot.project.updatedAt = project.updatedAt;
      projectAction.value = null;
      model.pauseAutosave(false);
    } else {
      try {
        await projectsApi.remove(projectId, signal);
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 404) throw error;
      }
      if (signal.aborted) return;
      leaving = true;
      projectAction.value = null;
      await router.replace('/projects');
    }
  } catch (error) {
    if (!signal.aborted)
      projectActionError.value = workspaceError(
        error,
        action === 'rename'
          ? 'Не вдалося перейменувати проєкт. Спробуйте ще раз.'
          : 'Не вдалося видалити проєкт. Спробуйте ще раз.',
      );
  } finally {
    projectActionBusy.value = false;
  }
}
async function submitResource(inputs: { file: File; path: string }[]) {
  const action = resourceAction.value;
  if (
    !action ||
    !state.snapshot ||
    !inputs.length ||
    resourceBusy.value ||
    state.pending ||
    ['saving', 'conflict'].includes(state.status)
  )
    return;
  resourceBusy.value = true;
  resourceError.value = '';
  uploadController = new AbortController();
  const signal = AbortSignal.any([resourceController.signal, uploadController.signal]);
  try {
    resourceUploading.value = true;
    for (const file of stagedResources.keys()) {
      if (!inputs.some((input) => input.file === file)) stagedResources.delete(file);
    }
    const textContents = new Map<File, string>();
    for (const { file } of inputs) {
      if (!isTextUpload(file)) continue;
      try {
        textContents.set(file, await readTextUpload(file));
        signal.throwIfAborted();
      } catch (error) {
        if (!signal.aborted)
          resourceError.value =
            error instanceof Error ? error.message : 'Не вдалося прочитати файл.';
        return;
      }
    }
    const operations: StructureChange[] = [];
    for (const { file, path } of inputs) {
      const content = textContents.get(file);
      if (content !== undefined) {
        operations.push({ type: 'createFile', path, content });
        continue;
      }
      let upload = stagedResources.get(file);
      if (!upload || Date.parse(upload.expiresAt) <= Date.now()) {
        upload = await resourceApi.upload(projectId, file, signal);
        signal.throwIfAborted();
        stagedResources.set(file, upload);
      }
      if (!matchesResourceType(path, upload.mediaType)) {
        resourceError.value = 'Розширення шляху має відповідати формату вибраного файла.';
        return;
      }
      operations.push(
        action.fileId === undefined
          ? { type: 'attachFile', path, uploadId: upload.uploadId }
          : { type: 'replaceFile', fileId: action.fileId, uploadId: upload.uploadId },
      );
    }
    resourceUploading.value = false;
    signal.throwIfAborted();
    resourceAttempted.value = true;
    if (await model.mutate(operations)) {
      if (action.fileId === undefined) showCreatedFile();
      resourceAction.value = null;
    } else if (state.status === 'conflict') resourceAction.value = null;
    else if (!state.structure.length && !state.pending) stagedResources.clear();
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
    } else if (!state.pending && !state.structure.length) stagedResources.clear();
  } finally {
    resourceBusy.value = false;
  }
}
function dismissResource() {
  if (resourceBusy.value && !resourceUploading.value) return;
  uploadController?.abort();
  if (resourceAttempted.value) model.cancelStructure();
  resourceAction.value = null;
}
function resourceClosed() {
  model.pauseAutosave(false);
  stagedResources.clear();
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
type FileAction = WorkspaceFileAction;
type InlineKind = 'create' | 'createDirectory' | 'rename' | 'renameDirectory';
type TreeAction = FileAction['kind'] | 'replace' | 'upload';
const fileAction = ref<FileAction | null>(null);
const inlineName = ref<{
  kind: InlineKind;
  directory: string;
  target?: number | string;
  name: string;
} | null>(null);
const nameTransfer = ref<string | null>(null);
const moveDestination = ref<string>();
const nameError = ref('');
const actionAttempted = ref(false);
const submittingFileAction = ref(false);
let fileActionFocus: HTMLElement | null = null;
let focusCreatedFile = false;
let focusTreeTarget: number | string | undefined;
let deferredFileAction: FileAction | null = null;
const actionsDisabled = computed(
  () =>
    state.loading ||
    reviewRevisionToRefresh.value !== null ||
    restoreLocked.value ||
    state.fileLoading ||
    state.conflictLoading ||
    state.status === 'conflict' ||
    state.status === 'saving' ||
    !!fileAction.value ||
    state.structure.length > 0 ||
    !!state.pending,
);
async function changeMaterial(operation: MaterialChange, target?: Material) {
  if (actionsDisabled.value || !state.snapshot) return false;
  if (
    target &&
    !state.snapshot.materials.some(
      (item) =>
        item.materialId === target.materialId &&
        item.versionId === target.versionId &&
        item.name === target.name,
    )
  )
    return false;
  const saved = await model.mutate([operation]);
  // The workspace owns retries once it has recorded an attempt.
  return saved || !!state.pending || state.structure.length > 0;
}
function fileDialogTrigger(trigger?: HTMLElement) {
  if (isMobile.value && mobileFilesVisible.value)
    return document.querySelector<HTMLElement>('.editor-files-toggle');
  return trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
}
function openFileAction(action: FileAction, trigger?: HTMLElement) {
  if (actionsDisabled.value) return;
  focusCreatedFile = false;
  focusTreeTarget = undefined;
  actionAttempted.value = false;
  nameTransfer.value = null;
  moveDestination.value = undefined;
  nameError.value = '';
  fileActionFocus = fileDialogTrigger(trigger);
  model.pauseAutosave(true);
  if (
    !isMobile.value &&
    ['create', 'createDirectory', 'rename', 'renameDirectory'].includes(action.kind)
  ) {
    const path =
      'directoryPath' in action
        ? action.directoryPath
        : state.snapshot?.tree.find((file) => file.fileId === action.fileId)?.path;
    const directory = 'directory' in action ? action.directory : parentFolder(path ?? '');
    const target = 'directoryPath' in action ? action.directoryPath : action.fileId;
    if (onlyOutput.value) viewMode.value = canSplit.value ? 'split' : 'code';
    desktopFilesVisible.value = true;
    revealFolder(directory);
    inlineName.value = {
      kind: action.kind as InlineKind,
      directory,
      ...(target === undefined ? {} : { target }),
      name: path?.split('/').at(-1) ?? '',
    };
  }
  if (isMobile.value && mobileFilesVisible.value) {
    deferredFileAction = action;
    mobileFilesVisible.value = false;
  } else fileAction.value = action;
}
function openTreeAction(kind: TreeAction, target: number | string, trigger: HTMLElement) {
  if (typeof target === 'string') {
    if (kind === 'create' || kind === 'createDirectory')
      openFileAction({ kind, directory: target }, trigger);
    if (kind === 'upload') openResource({ directory: target }, trigger);
    if (kind === 'renameDirectory' || kind === 'moveDirectory' || kind === 'deleteDirectory')
      openFileAction({ kind, directoryPath: target }, trigger);
    return;
  }
  const file = state.snapshot?.tree.find((entry) => entry.fileId === target);
  if (!file) return;
  if (kind === 'rename' || kind === 'move' || kind === 'delete' || kind === 'entrypoint')
    openFileAction({ kind, fileId: target }, trigger);
  if (kind === 'replace' && file.contentKind === 'binary')
    openResource({ directory: parentFolder(file.path), path: file.path, fileId: target }, trigger);
}
const treeDropDisabled = computed(
  () =>
    !!resourceAction.value || !!projectAction.value || historyOpen.value || actionsDisabled.value,
);
function moveTreeDrop(target: number | string, directory: string, trigger: HTMLElement) {
  if (treeDropDisabled.value) return;
  treeDropError.value = '';
  const action =
    typeof target === 'number'
      ? { kind: 'move' as const, fileId: target }
      : { kind: 'moveDirectory' as const, directoryPath: target };
  openFileAction(action, trigger);
  moveDestination.value = directory;
}
function uploadTreeDrop(files: File[], directory: string, trigger: HTMLElement) {
  if (treeDropDisabled.value || !files.length) return;
  openResource({ directory, files }, trigger);
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
  if (actionAttempted.value) model.cancelStructure();
  model.pauseAutosave(false);
  focusTreeTarget = inlineName.value?.target;
  const inline = !!inlineName.value;
  inlineName.value = null;
  fileAction.value = null;
  if (inline) void nextTick(fileActionClosed);
}
function fileActionClosed() {
  if (fileAction.value) return;
  const row =
    typeof focusTreeTarget === 'undefined'
      ? null
      : document.querySelector<HTMLElement>(
          `#workspace-files [data-tree-target="${CSS.escape(String(focusTreeTarget))}"]`,
        );
  if (focusCreatedFile && !isMobile.value) editor.value?.focus();
  else if (row && !isMobile.value) row.focus({ preventScroll: true });
  else if (fileActionFocus?.isConnected) fileActionFocus.focus();
  else document.querySelector<HTMLElement>('.editor-files-toggle')?.focus();
  fileActionFocus = null;
  focusTreeTarget = undefined;
}
const inlineEdit = computed(
  () =>
    inlineName.value && {
      ...inlineName.value,
      error: nameError.value || (actionAttempted.value ? state.saveError : ''),
      busy: submittingFileAction.value || state.status === 'saving',
      locked: actionAttempted.value && !!state.pending,
      retryLabel: state.status === 'refresh_failed' ? 'Оновити файли' : 'Повторити',
    },
);
function updateInlineName(name: string) {
  if (!inlineName.value) return;
  inlineName.value.name = name;
  nameError.value = '';
  if (actionAttempted.value && state.status === 'failed') {
    model.cancelStructure();
    actionAttempted.value = false;
  }
}
function submitInlineName() {
  const edit = inlineEdit.value;
  if (!edit || edit.busy || edit.locked) return;
  const directory = edit.kind === 'createDirectory' || edit.kind === 'renameDirectory';
  const name = edit.name;
  nameError.value = fileNameError(name, directory);
  if (nameError.value) return;
  const path = filePathInFolder(edit.directory, name);
  const currentPath =
    edit.kind === 'renameDirectory'
      ? edit.target
      : state.snapshot?.tree.find((file) => file.fileId === edit.target)?.path;
  if (path === currentPath) return dismissFileAction();
  if (directory && directories.value.includes(path)) {
    nameError.value = 'Папка з такою назвою вже існує.';
    return;
  }
  if (
    edit.kind === 'rename' &&
    edit.target === state.snapshot?.mainFileId &&
    !path.endsWith('.typ')
  ) {
    nameTransfer.value = name;
    inlineName.value = null;
    return;
  }
  void submitFileAction({ path });
}
let submittedPath: string | undefined;
async function submitFileAction(input: { path?: string; replacementId?: number }) {
  const action = fileAction.value;
  if (
    !action ||
    !state.snapshot ||
    submittingFileAction.value ||
    state.status === 'saving' ||
    state.pending
  )
    return;
  const operations: StructureChange[] = [];
  if (action.kind === 'create' && input.path)
    operations.push({ type: 'createFile', path: input.path, content: '' });
  if ((action.kind === 'rename' || action.kind === 'move') && input.path)
    operations.push({ type: 'renameFile', fileId: action.fileId, path: input.path });
  if (action.kind === 'createDirectory' && input.path)
    operations.push({ type: 'createDirectory', path: input.path });
  if ((action.kind === 'renameDirectory' || action.kind === 'moveDirectory') && input.path)
    operations.push({ type: 'renameDirectory', path: action.directoryPath, newPath: input.path });
  if (action.kind === 'deleteDirectory')
    operations.push({ type: 'deleteDirectory', path: action.directoryPath });
  if (action.kind === 'delete' && action.fileId)
    operations.push({ type: 'deleteFile', fileId: action.fileId });
  const main = state.snapshot?.tree.find(
    (file) => file.fileId === (action.kind === 'entrypoint' ? action.fileId : input.replacementId),
  );
  if (main) operations.push({ type: 'setEntrypoint', path: main.path });
  if (!operations.length) return;
  if (inlineName.value) {
    nameError.value = structureError(operations, state.snapshot);
    if (nameError.value) return;
  }
  submittedPath = input.path;
  actionAttempted.value = true;
  submittingFileAction.value = true;
  try {
    const saved = await model.mutate(operations);
    if (saved || state.status === 'conflict') finishFileAction(saved);
  } finally {
    submittingFileAction.value = false;
  }
}
async function retryFileAction() {
  if (submittingFileAction.value || !fileAction.value || !actionAttempted.value) return;
  submittingFileAction.value = true;
  try {
    await model.save();
    if (!state.pending && !state.structure.length && !state.saveError) finishFileAction(true);
    else if (state.status === 'conflict') finishFileAction(false);
  } finally {
    submittingFileAction.value = false;
  }
}
function finishFileAction(saved: boolean) {
  const action = fileAction.value;
  if (!action) return;
  if (saved) {
    if (action.kind === 'create') {
      showCreatedFile();
      focusCreatedFile = true;
    } else if (action.kind === 'rename' || action.kind === 'move') {
      if (submittedPath) revealFolder(parentFolder(submittedPath));
      treeSelection.value = action.fileId;
      focusTreeTarget = action.fileId;
    } else if (
      (action.kind === 'createDirectory' ||
        action.kind === 'renameDirectory' ||
        action.kind === 'moveDirectory') &&
      submittedPath
    ) {
      if ('directoryPath' in action) {
        const source = action.directoryPath;
        const destination = submittedPath;
        collapsedPaths.value = collapsedPaths.value.map((path) =>
          path === source || inFolder(path, source)
            ? destination + path.slice(source.length)
            : path,
        );
      }
      revealFolder(parentFolder(submittedPath));
      treeSelection.value = submittedPath;
      focusTreeTarget = submittedPath;
    } else if (action.kind === 'deleteDirectory') {
      const parent = parentFolder(action.directoryPath);
      collapsedPaths.value = collapsedPaths.value.filter(
        (path) => path !== action.directoryPath && !inFolder(path, action.directoryPath),
      );
      if (directories.value.includes(parent)) {
        treeSelection.value = parent;
        focusTreeTarget = parent;
      }
    }
  }
  const inline = !!inlineName.value;
  model.pauseAutosave(false);
  inlineName.value = null;
  fileAction.value = null;
  if (inline) void nextTick(fileActionClosed);
}
const mobileQuery = window.matchMedia('(max-width: 720px)');
const isMobile = ref(mobileQuery.matches);
const effectiveViewMode = computed<ViewMode>(() =>
  viewMode.value === 'split' && !canSplit.value ? 'code' : viewMode.value,
);
const onlyOutput = computed(() => effectiveViewMode.value === 'preview');
const showOutput = computed(() => effectiveViewMode.value !== 'code');
const livePreviewAllowed = computed(
  () =>
    livePreviewSupported &&
    !historyOpen.value &&
    !state.conflict &&
    !restoreLocked.value &&
    identitySession.user.value?.id === ownerId,
);
const previewInput = computed<PreviewInput | null>(() => {
  const snapshot = state.snapshot;
  if (
    !snapshot ||
    !livePreviewAllowed.value ||
    !previewEdited.value ||
    (!showOutput.value && !hasDraftText.value)
  )
    return null;
  return {
    revisionId: snapshot.revision.id,
    mainFileId: snapshot.mainFileId,
    tree: snapshot.tree,
    texts: new Map(Object.entries(state.files).map(([id, file]) => [Number(id), file.content])),
  };
});
watch(previewInput, (input) => {
  if (input) livePreview.request(input);
});
watch(
  [() => state.resetKey, () => Boolean(state.conflict), () => identitySession.user.value?.id],
  () => {
    livePreview.reset();
    previewEdited.value = hasDraftText.value;
  },
  { flush: 'sync' },
);
const displayDiagnostics = computed(() => {
  const snapshot = state.snapshot;
  const issues = livePreview.diagnostics.value;
  if (
    snapshot &&
    livePreviewAllowed.value &&
    issues.length &&
    draftDiagnosticsMatch(livePreview.diagnosticInput.value) &&
    (hasDraftText.value || compilation.state.artifact?.revision.id !== snapshot.revision.id)
  ) {
    return {
      revisionId: snapshot.revision.id,
      revisionNumber: null,
      items: issues.map((item): Diagnostic => {
        const path = item.path ?? null;
        const file = snapshot.tree.find((entry) => entry.path === path);
        return { ...item, path, fileId: file?.fileId ?? null, range: item.range ?? null };
      }),
    };
  }
  return compilation.state.diagnostics;
});

function warmLivePreview() {
  if (livePreviewAllowed.value) livePreview.warm();
}
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
  const { fileId } = item;
  if (fileId === null || !canOpenDiagnostic(item, revisionId)) return;
  const isDraft = displayDiagnostics.value?.revisionNumber === null;
  const resultInput = isDraft ? livePreview.diagnosticInput.value : undefined;
  if (isDraft && !draftDiagnosticsMatch(resultInput)) return;
  await selectFile(fileId);
  await nextTick();
  if (activeTab.value !== fileId || !canOpenDiagnostic(item, revisionId)) return;
  const file = state.files[fileId];
  const current = isDraft ? draftDiagnosticsMatch(resultInput) : file?.content === file?.base;
  await editor.value?.focusAt(fileId, current ? (item.range?.start ?? null) : null);
}

function draftDiagnosticsMatch(input: PreviewInput | undefined) {
  if (!input || state.snapshot?.revision.id !== input.revisionId) return false;
  return Object.entries(state.files).every(
    ([id, file]) => file.content === (input.texts.get(Number(id)) ?? file.base),
  );
}

async function openSourcePosition({ fileId, position, sha256, draft }: OutlineNavigation) {
  const file = state.snapshot?.tree.find((file) => file.fileId === fileId);
  if (!file || file.contentKind !== 'text') return;
  revealFolder(parentFolder(file.path));
  treeSelection.value = fileId;
  await selectFile(fileId);
  await nextTick();
  if (activeTab.value !== fileId) return;
  const source = state.files[fileId];
  const currentHash = state.snapshot?.tree.find((file) => file.fileId === fileId)?.sha256;
  const unchanged =
    source &&
    (draft !== undefined
      ? source.content === draft
      : currentHash === sha256 && source.content === source.base);
  await editor.value?.focusAt(fileId, unchanged ? position : null);
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
const desktopFilesVisible = ref(preferences.project.filesVisible);
const mobileFilesVisible = ref(false);
const collapsedPaths = ref<string[]>([]);
const treeSelection = ref<number | string | null>(null);
const selectedTreeFile = computed(() =>
  typeof treeSelection.value === 'number' ? treeSelection.value : 0,
);
const selectedFolder = computed(() =>
  typeof treeSelection.value === 'string' ? treeSelection.value : null,
);
const directories = computed(() =>
  projectFolders(state.snapshot?.tree ?? [], state.snapshot?.directories),
);
const fileActionDirty = computed(() => {
  const action = fileAction.value;
  if (!action) return false;
  if (action.kind === 'deleteDirectory')
    return (
      state.snapshot?.tree.some(
        (file) => inFolder(file.path, action.directoryPath) && dirtyIds.value.includes(file.fileId),
      ) ?? false
    );
  return !!action.fileId && dirtyIds.value.includes(action.fileId);
});
const creationDirectory = computed(() => {
  if (selectedFolder.value !== null) return selectedFolder.value;
  const file = state.snapshot?.tree.find((entry) => entry.fileId === selectedTreeFile.value);
  return file ? parentFolder(file.path) : '';
});
function revealFolder(directory: string) {
  collapsedPaths.value = collapsedPaths.value.filter(
    (path) => directory !== path && !inFolder(directory, path),
  );
}
function toggleFolder(path: string) {
  if (
    inlineName.value &&
    (inlineName.value.directory === path || inFolder(inlineName.value.directory, path))
  )
    return;
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
const workspaceElement = ref<HTMLElement | null>(null);
const layoutElement = ref<HTMLElement | null>(null);
const layoutWidth = ref(window.innerWidth);
const availableHeight = ref(window.innerHeight);
const separatorWidth = 6;
const minFilesWidth = 160;
const minContentWidth = 300;
const showDesktopFiles = computed(() => !isMobile.value && filesVisible.value && !onlyOutput.value);
const showSplit = computed(() => effectiveViewMode.value === 'split');
const commentsWidth = computed(() =>
  sideComments.value ? Math.max(250, Math.min(340, Math.round(layoutWidth.value * 0.24))) : 0,
);
const maxFilesWidth = computed(() => {
  const remaining = showSplit.value
    ? 2 * minContentWidth + 2 * separatorWidth
    : minContentWidth + separatorWidth;
  return Math.max(
    minFilesWidth,
    Math.min(420, layoutWidth.value - remaining - commentsWidth.value),
  );
});
const filesWidth = computed(() => Math.min(panelSizes.value.filesWidth, maxFilesWidth.value));
const splitWidth = computed(
  () =>
    layoutWidth.value -
    (showDesktopFiles.value ? filesWidth.value + separatorWidth : 0) -
    commentsWidth.value -
    separatorWidth,
);
const minCodeWidth = computed(() => Math.min(minContentWidth, Math.floor(splitWidth.value / 2)));
const maxCodeWidth = computed(() => splitWidth.value - minCodeWidth.value);
function widthForRatio(ratio: number) {
  return Math.max(
    minCodeWidth.value,
    Math.min(maxCodeWidth.value, Math.round(splitWidth.value * ratio)),
  );
}
const codeWidth = computed(() => widthForRatio(panelSizes.value.codeRatio));
const defaultCodeWidth = computed(() => widthForRatio(defaultPanelSizes.codeRatio));
const maxDiagnosticsHeight = computed(() =>
  Math.max(0, Math.min(480, Math.floor(availableHeight.value * 0.55), availableHeight.value - 190)),
);
const layoutCustomized = computed(
  () =>
    panelSizes.value.filesWidth !== defaultPanelSizes.filesWidth ||
    panelSizes.value.codeRatio !== defaultPanelSizes.codeRatio ||
    panelSizes.value.diagnosticsHeight !== null ||
    !desktopFilesVisible.value ||
    preferredMode.value !== undefined,
);

watch(
  [workspaceElement, layoutElement],
  ([workspace, layout], _, onCleanup) => {
    if (!workspace || !layout) return;
    function measure() {
      if (!workspace || !layout) return;
      layoutWidth.value = layout.clientWidth;
      availableHeight.value = Math.floor(
        workspace.getBoundingClientRect().bottom - layout.getBoundingClientRect().top,
      );
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(workspace);
    observer.observe(layout);
    onCleanup(() => observer.disconnect());
  },
  { flush: 'post' },
);

function resizeCode(width: number) {
  panelSizes.value.codeRatio =
    width === defaultCodeWidth.value ? defaultPanelSizes.codeRatio : width / splitWidth.value;
}

function resetLayout() {
  panelSizes.value = { ...defaultPanelSizes };
  preferredMode.value = undefined;
  desktopFilesVisible.value = true;
  mobileFilesVisible.value = false;
}

watch(panelSizes, preferences.savePanels, { deep: true, flush: 'sync' });
watch(
  [preferencesReady, desktopFilesVisible, preferredMode, tabIds, activeTab, pdfView],
  () => {
    if (!preferencesReady.value) return;
    preferences.saveProject({
      filesVisible: desktopFilesVisible.value,
      ...(preferredMode.value ? { mode: preferredMode.value } : {}),
      tabs: tabIds.value,
      activeTab: activeTab.value,
      ...(pdfView.value ? { pdf: pdfView.value } : {}),
    });
  },
  { deep: true, flush: 'sync' },
);
const editor = ref<InstanceType<typeof TextEditor> | null>(null);
const languageSession = createLanguageSession(projectId, identitySession.request);
const languageAvailable = ref(false);
const languageBusy = ref(false);
const languageFeedback = ref('');
const definitionOptions = ref<(OutlineNavigation & { path: string })[]>([]);
const definitionsOpen = ref(false);
let selectedDefinition: OutlineNavigation | undefined;
let languageCommand: AbortController | undefined;
const languageEnabled = computed(() => {
  const fileId = activeTab.value;
  return (
    languageAvailable.value &&
    typeof fileId === 'number' &&
    state.selectedId === fileId &&
    !!state.files[fileId] &&
    !onlyOutput.value &&
    !historyOpen.value &&
    !reviewOpen.value &&
    !state.fileLoading &&
    !state.fileError &&
    !restoreLocked.value &&
    !state.conflict &&
    !state.conflictLoading &&
    reviewRevisionToRefresh.value === null &&
    state.structure.length === 0 &&
    identitySession.user.value?.id === ownerId &&
    !!state.snapshot?.tree.some(
      (file) => file.fileId === fileId && file.contentKind === 'text' && file.path.endsWith('.typ'),
    )
  );
});

function currentEditorBuffers(): EditorBuffers {
  return new Map(
    Object.entries(state.files).map(([id, { base, content }]) => [Number(id), { base, content }]),
  );
}

function languageContextMatches(snapshot: Snapshot, buffers: EditorBuffers) {
  const current = state.snapshot;
  if (
    !current ||
    !languageEnabled.value ||
    current.mainFileId !== snapshot.mainFileId ||
    current.tree.length !== snapshot.tree.length
  )
    return false;
  const latest = new Map(current.tree.map((file) => [file.fileId, file]));
  return snapshot.tree.every((file) => {
    const next = latest.get(file.fileId);
    if (!next || next.path !== file.path || next.contentKind !== file.contentKind) return false;
    const before = buffers.get(file.fileId);
    const after = state.files[file.fileId];
    if (before && after) return before.content === after.content;
    return (
      file.sha256 === next.sha256 &&
      (!before || before.content === before.base) &&
      (!after || after.content === after.base)
    );
  });
}

async function queryLanguage(
  fileId: number,
  method: LanguageMethod,
  signal: AbortSignal,
  position?: Position,
) {
  const snapshot = state.snapshot;
  if (!snapshot || !languageEnabled.value || activeTab.value !== fileId)
    throw new DOMException('Editor changed', 'AbortError');
  const buffers = currentEditorBuffers();
  const answer = await languageSession.query(
    {
      revisionId: snapshot.revision.id,
      fileId,
      buffers,
      method,
      ...(position ? { position } : {}),
    },
    signal,
  );
  signal.throwIfAborted();
  if (activeTab.value !== fileId || !languageContextMatches(snapshot, buffers))
    throw new DOMException('Editor changed', 'AbortError');
  return { ...answer, snapshot, buffers };
}

function receiveLanguageError(error: unknown, signal: AbortSignal, message: string) {
  if (signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) return;
  if (error instanceof ApiError && error.code === 'EDITOR_UNAVAILABLE')
    languageAvailable.value = false;
  languageFeedback.value = message;
}

async function requestCompletion(
  fileId: number,
  position: Position,
  signal: AbortSignal,
  explicit: boolean,
) {
  if (explicit) languageFeedback.value = '';
  try {
    return (await queryLanguage(fileId, 'completion', signal, position)).result;
  } catch (error) {
    if (explicit)
      receiveLanguageError(error, signal, 'Не вдалося отримати підказки. Спробуйте ще раз.');
    else if (error instanceof ApiError && error.code === 'EDITOR_UNAVAILABLE')
      languageAvailable.value = false;
    throw error;
  }
}

async function runLanguageCommand(method: 'formatting' | 'definition') {
  const source = editor.value?.captureSource();
  if (!languageEnabled.value || languageBusy.value || !source) return;
  const controller = new AbortController();
  languageCommand = controller;
  languageBusy.value = true;
  languageFeedback.value = method === 'formatting' ? 'Форматуємо файл…' : 'Шукаємо визначення…';
  const pendingMessage = languageFeedback.value;
  editor.value?.focus();
  try {
    const { result, files, buffers, snapshot } = await queryLanguage(
      source.fileId,
      method,
      controller.signal,
      method === 'definition' ? source.position : undefined,
    );
    if (!editor.value?.sameSource(source, method === 'definition')) return;
    if (method === 'formatting') {
      const changed = editor.value.applyFormatting(source, result);
      if (changed !== null)
        languageFeedback.value = changed ? 'Файл відформатовано.' : 'Файл уже відформатовано.';
      return;
    }

    const targets = readDefinitions(result, files).flatMap((definition) => {
      const file = snapshot.tree.find((file) => file.fileId === definition.fileId);
      if (!file || file.contentKind !== 'text') return [];
      const buffer = buffers.get(definition.fileId);
      return [
        {
          ...definition,
          path: file.path,
          sha256: file.sha256,
          draft: buffer?.content,
        },
      ];
    });
    if (targets.length === 1) await openSourcePosition(targets[0]!);
    else if (targets.length > 1) {
      definitionOptions.value = targets;
      definitionsOpen.value = true;
    } else languageFeedback.value = 'Визначення не знайдено.';
  } catch (error) {
    receiveLanguageError(
      error,
      controller.signal,
      method === 'formatting' ? 'Не вдалося відформатувати файл.' : 'Не вдалося знайти визначення.',
    );
  } finally {
    if (languageCommand === controller) {
      languageCommand = undefined;
      languageBusy.value = false;
      if (languageFeedback.value === pendingMessage) languageFeedback.value = '';
    }
  }
}

function chooseDefinition(target: OutlineNavigation) {
  selectedDefinition = target;
  definitionsOpen.value = false;
}

function afterDefinitionsClose() {
  if (selectedDefinition) void openSourcePosition(selectedDefinition);
  selectedDefinition = undefined;
  definitionOptions.value = [];
}

watch(activeTab, () => {
  languageCommand?.abort();
  languageFeedback.value = '';
});

const commentAnchor = computed(() => {
  const selection = textSelection.value;
  if (!selection || selection.fileId !== activeTab.value || onlyOutput.value) return null;
  const file = state.files[selection.fileId];
  return file ? createTextAnchor(file.content, selection.fileId, selection) : null;
});
const annotationMarks = computed(() => {
  const fileId = activeTab.value;
  const file = typeof fileId === 'number' ? state.files[fileId] : null;
  if (!file || file.base !== file.content) return [];
  return annotations.value.flatMap((item) => {
    const { position } = item;
    if (
      item.fileId !== fileId ||
      item.status !== 'active' ||
      item.viewedRevisionId !== state.snapshot?.revision.id ||
      position.state !== 'attached' ||
      position.start === null ||
      position.end === null
    )
      return [];
    const selection = editorSelection(
      file.content,
      position.start,
      position.end,
      item.anchor.quote,
    );
    return selection ? [{ id: item.id, ...selection }] : [];
  });
});

function receiveSelection(fileId: number, selection: TextSelection | null) {
  textSelection.value = selection ? { ...selection, fileId } : null;
}

async function openComments(anchor?: TextAnchor) {
  commentsOpen.value = true;
  await nextTick();
  if (anchor) {
    await commentsPanel.value?.start(anchor);
  } else if (sideComments.value) commentsPanel.value?.focus();
}

async function openAnnotation(id: number) {
  commentsOpen.value = true;
  await nextTick();
  await commentsPanel.value?.show(id, true);
}

async function closeComments(focus = true) {
  commentsOpen.value = false;
  activeAnnotation.value = null;
  if (focus) {
    await nextTick();
    commentsTrigger.value?.focus({ preventScroll: true });
  }
}

async function prepareAnnotation(anchor: TextAnchor) {
  if (actionsDisabled.value) return null;
  const matches = (source: string | undefined) =>
    source !== undefined &&
    source.slice(anchor.start, anchor.end) === anchor.quote &&
    source.slice(0, anchor.start).endsWith(anchor.prefix) &&
    source.slice(anchor.end).startsWith(anchor.suffix);
  const file = state.files[anchor.fileId];
  if (!matches(file?.content)) return null;
  if (file!.base !== file!.content) await model.save();
  const saved = state.files[anchor.fileId];
  if (!saved || saved.base !== saved.content || !matches(saved.base) || actionsDisabled.value)
    return null;
  return state.snapshot?.revision.id ?? null;
}

async function revealAnnotation(item: Annotation) {
  const { position } = item;
  if (position.start === null || position.end === null) return;
  if (!canSplit.value) await closeComments(false);
  await selectFile(item.fileId);
  await nextTick();
  const file = state.files[item.fileId];
  if (
    !file ||
    activeTab.value !== item.fileId ||
    state.snapshot?.revision.id !== item.viewedRevisionId
  )
    return;
  const selection =
    file.base === file.content
      ? editorSelection(file.content, position.start, position.end, item.anchor.quote)
      : null;
  if (selection) await editor.value?.reveal(item.fileId, selection);
}
const emptyMainFileAction = ref<HTMLButtonElement | null>(null);
const dirtyIds = computed(() =>
  Object.entries(state.files)
    .filter(([, file]) => file.base !== file.content)
    .map(([id]) => Number(id)),
);
function viewportChanged(event: MediaQueryListEvent) {
  isMobile.value = event.matches;
  mobileFilesVisible.value = false;
  if (event.matches && inlineName.value) {
    nameTransfer.value = inlineName.value.name;
    inlineName.value = null;
  }
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
  if (onlyOutput.value) viewMode.value = canSplit.value ? 'split' : 'code';
  revealFolder(parentFolder(file.path));
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
      (typeof selection === 'string' && !directories.value.includes(selection))
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
  () =>
    atRisk.value ||
    resourceUploading.value ||
    restoreLocked.value ||
    reviewBusy.value ||
    commentsDirty.value,
);
function allowLeave() {
  if (reviewBusy.value) return false;
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
onBeforeRouteUpdate((to, from) => {
  if (!identitySession.user.value) return true;
  if (reviewBusy.value) return false;
  return to.params.projectId === from.params.projectId || allowLeave();
});
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
function initializeWorkspaceOutput() {
  if (historyOpen.value || reviewOpen.value) return;
  if (!startupAttempted.value) {
    startupAttempted.value = true;
    void compilation.openStartup();
  }
}
async function loadWorkspace() {
  await model.load(takeWorkspaceRecovery(ownerId, projectId));
  if (restoreController.signal.aborted || !state.snapshot || state.error) return;
  const { tabs: storedTabs, activeTab: storedActiveTab } = preferences.project;
  if (storedTabs) {
    const valid = new Set(state.snapshot.tree.map((file) => file.fileId));
    tabIds.value = storedTabs.filter((tab) => tab === 'context' || valid.has(tab));
    const restored =
      storedActiveTab != null && tabIds.value.includes(storedActiveTab)
        ? storedActiveTab
        : tabIds.value.at(-1);
    if (restored !== undefined) await activateTab(restored);
    else if (storedTabs.length) showTab(state.selectedId);
  } else showTab(state.selectedId);
  if (restoreController.signal.aborted) return;
  preferencesReady.value = true;
  workspaceLoaded = true;
  initializeWorkspaceOutput();
  if (historyOpen.value) void refreshHistoryHead();
}
async function retryWorkspace() {
  await loadWorkspace();
  await nextTick();
  if (state.error) workspaceLoadError.value?.focusAction();
  else workspaceHeading.value?.focus({ preventScroll: true });
}
watch(reviewOpen, (open) => {
  if (open) mobileFilesVisible.value = false;
  else if (workspaceLoaded) initializeWorkspaceOutput();
});
onMounted(() => {
  mobileQuery.addEventListener('change', viewportChanged);
  splitQuery.addEventListener('change', splitChanged);
  window.addEventListener('pagehide', preferences.flush);
  void loadWorkspace();
  void languageToolsAvailable(identitySession.request, restoreController.signal)
    .then((available) => {
      if (!restoreController.signal.aborted) languageAvailable.value = available;
    })
    .catch(() => undefined);
});
onBeforeUnmount(() => {
  languageCommand?.abort();
  languageSession.dispose();
  livePreview.reset();
  preferences.flush();
  window.removeEventListener('pagehide', preferences.flush);
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
  <section ref="workspaceElement" class="page editor-page" :aria-busy="state.loading">
    <div v-if="state.loading" class="editor-state" role="status">Завантаження проєкту…</div>
    <LoadError
      v-else-if="state.error"
      ref="workspaceLoadError"
      variant="page"
      :title="state.unavailable ? 'Проєкт недоступний' : 'Не вдалося відкрити проєкт'"
      :message="state.error"
      :retry-label="state.unavailable ? '' : 'Повторити'"
      @retry="retryWorkspace"
    >
      <template #actions>
        <RouterLink class="button button-secondary" to="/projects">До проєктів</RouterLink>
      </template>
    </LoadError>
    <template v-else-if="state.snapshot">
      <div class="editor-heading" :class="{ 'editor-heading-commands': !state.conflict }">
        <button
          v-if="!state.conflict && !onlyOutput"
          class="editor-files-toggle"
          :aria-expanded="filesVisible"
          :aria-controls="isMobile ? undefined : 'workspace-files'"
          :aria-label="filesVisible ? 'Приховати файли' : 'Показати файли'"
          :title="filesVisible ? 'Приховати файли' : 'Показати файли'"
          :disabled="!!inlineName"
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
        <h1 ref="workspaceHeading" tabindex="-1" :title="state.snapshot.project.title">
          {{ state.snapshot.project.title }}
        </h1>
        <WorkspaceMainMenu
          v-if="!isMobile && !state.conflict"
          :groups="menuGroups"
          @command="runWorkspaceCommand"
        />
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
          <WorkspaceMainMenu v-if="isMobile" :groups="menuGroups" @command="runWorkspaceCommand" />
          <button
            ref="commentsTrigger"
            type="button"
            class="file-icon-button"
            aria-label="Коментарі"
            title="Коментарі"
            :aria-expanded="commentsOpen"
            :aria-haspopup="canSplit ? undefined : 'dialog'"
            @click="commentsOpen ? commentsPanel?.requestClose() : openComments()"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              aria-hidden="true"
            >
              <path
                d="M4 3.8h12a1 1 0 0 1 1 1v8.4a1 1 0 0 1-1 1H8l-4 3v-3a1 1 0 0 1-1-1V4.8a1 1 0 0 1 1-1Z"
              />
              <path d="M6.5 7.2h7m-7 3.3h5" />
            </svg>
          </button>
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
              :disabled="!!inlineName"
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
      <div v-if="reviewRevisionToRefresh !== null && !reviewOpen" class="editor-notice">
        <p v-if="reviewRefreshing" role="status">Оновлення файлів редактора…</p>
        <template v-else>
          <p role="alert">Пропозицію прийнято. Не вдалося оновити файли редактора.</p>
          <button class="button button-secondary" @click="retryReviewRefresh">Оновити файли</button>
        </template>
      </div>
      <p v-if="pdfOpenError && !historyOpen" class="editor-notice" role="alert">
        {{ pdfOpenError }}
      </p>
      <p v-if="treeDropError && !historyOpen" class="editor-notice" role="alert">
        {{ treeDropError }}
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
      <div
        v-if="state.saveError && !state.conflict && !(fileAction && actionAttempted)"
        class="editor-notice"
        role="alert"
      >
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
            {{
              state.status === 'refresh_failed'
                ? materialChangePending
                  ? 'Оновити матеріали'
                  : 'Оновити файли'
                : 'Повторити збереження'
            }}
          </button>
          <button
            v-if="state.structure.length && state.status === 'failed' && !state.pending"
            class="button button-quiet"
            @click="model.cancelStructure()"
          >
            {{ materialChangePending ? 'Скасувати зміну матеріалу' : 'Скасувати зміну файлів' }}
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
          <h3>{{ materialChangePending ? 'Зміна матеріалу' : 'Зміни файлів' }}</h3>
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
      <WorkspaceReview
        v-if="reviewOpen"
        :project-id="projectId"
        :head-id="state.snapshot.revision.id"
        :head-number="state.snapshot.revision.number"
        :can-decide="
          state.status === 'clean' &&
          !atRisk &&
          !resourceBusy &&
          !restoreLocked &&
          reviewRevisionToRefresh === null
        "
        :refresh-accepted="refreshAfterReview"
        @busy="reviewBusy = $event"
        @dismiss="closeReview"
      />
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
        ref="layoutElement"
        class="editor-layout"
        :class="{
          'editor-without-files': !showDesktopFiles,
          'editor-with-output': showSplit,
          'editor-with-comments': sideComments,
        }"
        :style="{
          '--editor-file-width': `${filesWidth}px`,
          '--editor-code-width': `${codeWidth}px`,
          '--editor-comments-width': `${commentsWidth}px`,
        }"
      >
        <aside
          v-if="!isMobile"
          v-show="showDesktopFiles"
          id="workspace-files"
          class="editor-files"
          aria-label="Файли проєкту"
          @click.self="treeSelection = null"
        >
          <div class="editor-files-heading">
            <h2>Файли</h2>
            <FileAddMenu
              :disabled="actionsDisabled"
              :upload-disabled="state.status === 'saving'"
              @create="openFileAction({ kind: 'create', directory: creationDirectory })"
              @create-directory="
                openFileAction({ kind: 'createDirectory', directory: creationDirectory })
              "
              @upload="openResource({ directory: creationDirectory })"
            />
          </div>
          <WorkspaceFiles
            :files="state.snapshot.tree"
            :directories="directories"
            :selected-id="selectedTreeFile"
            :selected-folder="selectedFolder"
            :dirty-ids="dirtyIds"
            :collapsed-paths="collapsedPaths"
            :main-file-id="state.snapshot.mainFileId"
            :disabled="actionsDisabled"
            :replace-disabled="state.status === 'saving'"
            :drop-disabled="treeDropDisabled"
            :mobile="false"
            v-bind="inlineEdit ? { inlineEdit } : {}"
            @click.self="treeSelection = null"
            @keydown.esc="treeSelection = null"
            @toggle="toggleFolder"
            @select="selectTreeFile"
            @select-folder="treeSelection = $event"
            @action="openTreeAction"
            @move-drop="moveTreeDrop"
            @upload-drop="uploadTreeDrop"
            @folder-drop-rejected="treeDropError = 'Перетягніть окремі файли без папок.'"
            @inline-input="updateInlineName"
            @inline-submit="submitInlineName"
            @inline-cancel="dismissFileAction"
            @inline-retry="retryFileAction"
          />
        </aside>
        <WorkspaceSeparator
          v-if="showDesktopFiles"
          label="Змінити ширину панелі файлів"
          controls="workspace-files"
          orientation="vertical"
          :value="filesWidth"
          :min="minFilesWidth"
          :max="maxFilesWidth"
          :default-value="defaultPanelSizes.filesWidth"
          @change="panelSizes.filesWidth = $event"
        />
        <section
          v-show="!onlyOutput"
          id="workspace-source"
          class="editor-source"
          aria-label="Редактор файла"
          @focusin="warmLivePreview"
        >
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
                :readonly="
                  state.conflictLoading || restoreLocked || reviewRevisionToRefresh !== null
                "
                placeholder="Вимоги, домовленості та примітки до документа"
                @input="model.editContext(($event.target as HTMLTextAreaElement).value)"
                @keydown.ctrl.s.prevent="model.save()"
                @keydown.meta.s.prevent="model.save()"
                @compositionstart="model.composition(true)"
                @compositionend="model.composition(false)"
                @blur="model.composition(false)"
              />
              <WorkspaceMaterials
                :project-id="projectId"
                :revision-id="state.snapshot.revision.id"
                :materials="state.snapshot.materials"
                :active="contextOpen && !onlyOutput"
                :locked="actionsDisabled"
                :change="changeMaterial"
                :download="downloadBlob"
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
            <LoadError
              v-else-if="hasFileTab && state.fileError"
              class="editor-file-message"
              title="Не вдалося відкрити файл"
              :message="state.fileError"
              retry-label="Повторити завантаження"
              @retry="model.select(state.selectedId)"
            />
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
            <p
              v-if="hasFileTab && languageFeedback"
              class="workspace-language-feedback"
              role="status"
            >
              {{ languageFeedback }}
            </p>
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
              v-bind="languageEnabled ? { complete: requestCompletion } : {}"
              :annotations="annotationMarks"
              :show-comment-gutter="!commentsOpen"
              :active-annotation="activeAnnotation"
              :can-comment="!!commentAnchor && !actionsDisabled"
              :align-comments="sideComments && !onlyOutput && hasFileTab"
              :readonly="
                restoreLocked ||
                reviewRevisionToRefresh !== null ||
                state.conflictLoading ||
                state.structure.some(
                  (operation) =>
                    operation.type === 'deleteFile' && operation.fileId === state.selectedId,
                )
              "
              @update:model-value="(value, fileId) => model.edit(fileId, value)"
              @save="model.save()"
              @language-command="runLanguageCommand"
              @completion-empty="languageFeedback = 'Підказок у цій позиції немає.'"
              @composition="model.composition"
              @selection="receiveSelection"
              @annotation="commentsPanel?.show($event)"
              @gutter-comment="openAnnotation"
              @comment="commentAnchor && openComments(commentAnchor)"
              @comment-layout="commentLayout = $event"
            />
          </div>
        </section>
        <div v-if="sideComments" id="workspace-annotation-side" />
        <WorkspaceSeparator
          v-if="showSplit"
          label="Змінити співвідношення коду й PDF"
          controls="workspace-source"
          orientation="vertical"
          :value="codeWidth"
          :min="minCodeWidth"
          :max="maxCodeWidth"
          :default-value="defaultCodeWidth"
          @change="resizeCode"
        />
        <WorkspaceOutput
          v-show="showOutput"
          :output="compilation.state"
          :initial-view="pdfView"
          :draft="liveDocument"
          :current-revision-id="state.snapshot.revision.id"
          :draft-dirty="hasDraftText"
          @draft-closed="livePreview.discard"
          @view-change="pdfView = $event"
          @retry="compilation.retry"
          @download="downloadPdf"
          @open="openPdf"
        />
      </div>
      <Teleport
        defer
        :to="sideComments ? '#workspace-annotation-side' : 'body'"
        :disabled="!sideComments"
      >
        <WorkspaceComments
          ref="commentsPanel"
          :open="commentsOpen"
          :project-id="projectId"
          :revision-id="state.snapshot.revision.id"
          :files="state.snapshot.tree"
          :dirty-file-ids="dirtyIds"
          :layout="
            sideComments && !onlyOutput && activeTab === commentLayout?.fileId
              ? commentLayout
              : null
          "
          :compact="!sideComments"
          :selection="commentAnchor"
          :locked="actionsDisabled"
          :prepare="prepareAnnotation"
          @dismiss="closeComments()"
          @list="annotations = $event"
          @reveal="revealAnnotation"
          @highlight="activeAnnotation = $event"
          @dirty="commentsDirty = $event"
        />
      </Teleport>
      <ModalDialog
        :open="definitionsOpen"
        title="Визначення"
        @dismiss="definitionsOpen = false"
        @closed="afterDefinitionsClose"
      >
        <ul class="workspace-definition-list">
          <li
            v-for="item in definitionOptions"
            :key="`${item.fileId}:${item.position.line}:${item.position.character}`"
          >
            <button type="button" class="button button-secondary" @click="chooseDefinition(item)">
              <span>{{ item.path }}</span>
              <span class="muted">Рядок {{ item.position.line + 1 }}</span>
            </button>
          </li>
        </ul>
        <div class="modal-actions">
          <button type="button" class="button button-secondary" @click="definitionsOpen = false">
            Закрити
          </button>
        </div>
      </ModalDialog>
      <WorkspaceOutline
        v-if="!state.conflict"
        :open="outlineOpen"
        :project-id="projectId"
        :snapshot="state.snapshot"
        :drafts="outlineDrafts"
        :read-text="workspaceApi.text"
        :request="identitySession.request"
        @dismiss="outlineOpen = false"
        @navigate="openSourcePosition"
      />
      <WorkspaceDiagnostics
        v-if="!state.conflict"
        v-model:open="diagnosticsOpen"
        :result="displayDiagnostics"
        :height="panelSizes.diagnosticsHeight"
        :max-height="maxDiagnosticsHeight"
        :can-open-file="canOpenDiagnostic"
        @resize="panelSizes.diagnosticsHeight = $event"
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
            @create-directory="
              openFileAction({ kind: 'createDirectory', directory: creationDirectory })
            "
            @upload="openResource({ directory: creationDirectory })"
          />
          <WorkspaceFiles
            :files="state.snapshot.tree"
            :directories="directories"
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
        :open="!!fileAction && !inlineName"
        :action="fileAction"
        v-bind="nameTransfer === null ? {} : { initialName: nameTransfer }"
        :initial-directory="moveDestination"
        :files="state.snapshot.tree"
        :directories="directories"
        :main-file-id="state.snapshot.mainFileId"
        :dirty="fileActionDirty"
        :busy="submittingFileAction || state.status === 'saving'"
        :locked="actionAttempted && !!state.pending && state.status !== 'saving'"
        :error="actionAttempted ? state.saveError : ''"
        @submit="submitFileAction"
        @retry="retryFileAction"
        @dismiss="dismissFileAction"
        @closed="fileActionClosed"
      />
      <ResourceDialog
        :open="!!resourceAction"
        :replacement-path="resourceAction?.path"
        :directory="resourceAction?.directory ?? ''"
        :initial-files="resourceAction?.files"
        :files="state.snapshot.tree"
        :directories="directories"
        :busy="resourceBusy || state.status === 'saving'"
        :uploading="resourceUploading"
        :locked="resourceAttempted && !!state.pending && state.status !== 'saving'"
        :error="resourceError || (resourceAttempted ? state.saveError : '')"
        @submit="submitResource"
        @retry="retryResource"
        @dismiss="dismissResource"
        @closed="resourceClosed"
      />
      <ProjectTransferDialog
        v-if="transfer"
        v-bind="transfer"
        :project-id="projectId"
        :project-title="state.snapshot.project.title"
        @dismiss="transfer = null"
      />
      <ModalDialog
        :open="!!projectAction"
        :title="projectAction === 'delete' ? 'Видалити проєкт?' : 'Перейменувати проєкт'"
        :busy="projectActionBusy"
        dialog-class="workspace-project-dialog"
        @dismiss="dismissProjectAction"
      >
        <form v-if="projectAction" novalidate @submit.prevent="submitProjectAction">
          <template v-if="projectAction === 'delete'">
            <p class="workspace-project-delete-name">{{ state.snapshot.project.title }}</p>
            <p id="workspace-project-delete-warning" class="muted">
              Проєкт і його файли стануть недоступними. Скасувати цю дію в застосунку неможливо.
            </p>
            <p v-if="workspaceAtRisk" id="workspace-project-draft-warning" class="field-error">
              Незбережені правки буде втрачено.
            </p>
          </template>
          <div v-else class="form-field">
            <label for="workspace-project-title">Назва</label>
            <input
              id="workspace-project-title"
              v-model="projectTitle"
              autofocus
              autocomplete="off"
              :disabled="projectActionBusy"
              :aria-invalid="!!projectTitleError"
              :aria-describedby="projectTitleError ? 'workspace-project-title-error' : undefined"
              @input="projectTitleError = ''"
            />
            <p
              v-if="projectTitleError"
              id="workspace-project-title-error"
              class="field-error"
              role="alert"
            >
              {{ projectTitleError }}
            </p>
          </div>
          <p v-if="projectActionError" class="field-error" role="alert">{{ projectActionError }}</p>
          <div class="modal-actions">
            <button
              type="button"
              class="button button-secondary"
              :autofocus="projectAction === 'delete'"
              :disabled="projectActionBusy"
              @click="dismissProjectAction"
            >
              Скасувати
            </button>
            <button
              type="submit"
              :class="['button', projectAction === 'delete' ? 'button-danger' : 'button-primary']"
              :disabled="projectActionBusy || state.status === 'saving'"
              :aria-describedby="
                projectAction === 'delete'
                  ? workspaceAtRisk
                    ? 'workspace-project-delete-warning workspace-project-draft-warning'
                    : 'workspace-project-delete-warning'
                  : undefined
              "
            >
              {{
                projectActionBusy
                  ? 'Зачекайте…'
                  : projectAction === 'delete'
                    ? 'Видалити'
                    : 'Зберегти'
              }}
            </button>
          </div>
        </form>
      </ModalDialog>
    </template>
  </section>
</template>
