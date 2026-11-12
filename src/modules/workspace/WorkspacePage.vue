<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { onBeforeRouteLeave, useRoute } from 'vue-router';
import { identitySession } from '../identity/identity-session';
import { createWorkspaceApi } from './workspace-api';
import { createWorkspaceModel } from './workspace-model';
import {
  registerWorkspaceExit,
  retainWorkspace,
  takeWorkspaceRecovery,
} from './workspace-lifecycle';
import TextEditor from './TextEditor.vue';
import WorkspaceFiles from './WorkspaceFiles.vue';
import ModalDialog from '../../shared/ui/ModalDialog.vue';
import FileActionDialog from './FileActionDialog.vue';
import type { StructureChange } from './workspace-api';
import './workspace.css';

const route = useRoute();
const projectId = Number(route.params.projectId);
const ownerId = identitySession.user.value!.id;
const model = createWorkspaceModel(projectId, createWorkspaceApi(identitySession.request));
const { state, atRisk } = model;
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
    state.fileLoading ||
    state.conflictLoading ||
    state.status === 'conflict' ||
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
function allowLeave() {
  if (!atRisk.value || leaving) return true;
  const confirmed = window.confirm(
    'Є незбережені зміни або непідтверджене збереження. Якщо вийти, локальні правки буде втрачено. Залишити сторінку?',
  );
  if (confirmed) leaving = true;
  return confirmed;
}
const unregister = registerWorkspaceExit(allowLeave);
watch(atRisk, (value) => {
  if (value) window.addEventListener('beforeunload', beforeUnload);
  else window.removeEventListener('beforeunload', beforeUnload);
});
onBeforeRouteLeave(() => !identitySession.user.value || allowLeave());
function beforeUnload(event: BeforeUnloadEvent) {
  if (!atRisk.value) return;
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
          fileChanges: state.structure,
        },
        null,
        2,
      ),
    ],
    { type: 'application/json;charset=utf-8' },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `project-${projectId}-draft.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
onMounted(() => {
  mobileQuery.addEventListener('change', viewportChanged);
  document.addEventListener('pointerdown', closeFileMenu);
  void model.load(takeWorkspaceRecovery(ownerId, projectId));
});
onBeforeUnmount(() => {
  mobileQuery.removeEventListener('change', viewportChanged);
  document.removeEventListener('pointerdown', closeFileMenu);
  if (!leaving && !identitySession.user.value) retainWorkspace(ownerId, projectId, model.recover());
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
      <button class="button button-secondary" @click="model.load()">Повторити</button>
    </div>
    <template v-else-if="state.snapshot">
      <div class="editor-heading">
        <button
          v-if="!state.conflict"
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
        <span
          role="status"
          class="editor-save-status"
          :class="{ 'save-idle': state.status === 'clean' }"
          >{{ labels[state.status] }}</span
        >
      </div>
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
            v-else
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
        <article v-for="file in state.conflict.files" :key="file.fileId" class="conflict-file">
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
      <div
        v-else
        class="editor-layout"
        :class="{ 'editor-without-files': isMobile || !filesVisible }"
      >
        <aside
          v-if="!isMobile"
          v-show="filesVisible"
          id="workspace-files"
          class="editor-files"
          aria-label="Файли проєкту"
        >
          <div class="editor-files-heading">
            <h2>Файли</h2>
            <button
              class="file-icon-button"
              aria-label="Новий файл"
              title="Новий файл"
              :disabled="actionsDisabled"
              @click="openFileAction('create')"
            >
              <svg
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                stroke-width="1.4"
                aria-hidden="true"
              >
                <path d="M10 4v12M4 10h12" />
              </svg>
            </button>
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
        <section class="editor-source" aria-label="Редактор файла">
          <div class="editor-file-bar">
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
          <p v-if="state.fileLoading" role="status" class="editor-file-message">
            Завантаження файла…
          </p>
          <div v-else-if="state.fileError" role="alert" class="editor-file-message">
            <p>{{ state.fileError }}</p>
            <button class="button button-secondary" @click="model.select(state.selectedId)">
              Повторити завантаження
            </button>
          </div>
          <p v-else-if="selectedMeta?.contentKind === 'binary'" class="editor-file-message">
            Цей файл не містить редагованого тексту.
          </p>
          <TextEditor
            v-show="
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
          <button
            class="file-icon-button drawer-new"
            aria-label="Новий файл"
            title="Новий файл"
            :disabled="actionsDisabled"
            @click="openFileAction('create')"
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              stroke-width="1.4"
              aria-hidden="true"
            >
              <path d="M10 4v12M4 10h12" />
            </svg>
          </button>
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
    </template>
  </section>
</template>
