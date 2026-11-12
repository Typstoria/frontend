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
import './workspace.css';

const route = useRoute();
const projectId = Number(route.params.projectId);
const ownerId = identitySession.user.value!.id;
const model = createWorkspaceModel(projectId, createWorkspaceApi(identitySession.request));
const { state, atRisk } = model;
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
        { title: state.snapshot?.project.title, files, comparisons: state.conflict?.files },
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
  void model.load(takeWorkspaceRecovery(ownerId, projectId));
});
onBeforeUnmount(() => {
  mobileQuery.removeEventListener('change', viewportChanged);
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
        <p>{{ state.saveError }}</p>
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
            Повторити збереження
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
          <h2>Файли</h2>
          <WorkspaceFiles
            :files="state.snapshot.tree"
            :selected-id="state.selectedId"
            :dirty-ids="dirtyIds"
            :collapsed-paths="collapsedPaths"
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
            :readonly="state.conflictLoading"
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
          <WorkspaceFiles
            :files="state.snapshot.tree"
            :selected-id="state.selectedId"
            :dirty-ids="dirtyIds"
            :collapsed-paths="collapsedPaths"
            @toggle="toggleFolder"
            @select="selectFile"
          />
        </ModalDialog>
      </div>
    </template>
  </section>
</template>
