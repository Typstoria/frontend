<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import ModalDialog from '../../shared/ui/ModalDialog.vue';
import LoadError from '../../shared/ui/LoadError.vue';
import { identitySession } from '../identity/identity-session';
import { ApiError } from '../../shared/api/client';
import {
  chunkLocation,
  createMaterialApi,
  materialAccept,
  materialFileError,
  type MaterialRead,
  type MaterialSearch,
} from './material-api';
import type { Material } from './material-metadata';
import type { MaterialChange } from './workspace-api';
import { workspaceError } from './workspace-model';

const props = defineProps<{
  projectId: number;
  revisionId: number;
  materials: Material[];
  active: boolean;
  locked: boolean;
  change: (operation: MaterialChange, target?: Material) => Promise<boolean>;
  download: (blob: Blob, filename: string) => void;
}>();

const api = createMaterialApi(props.projectId, identitySession.request);
const lifetime = new AbortController();
const action = shallowRef<{
  type: 'add' | 'replace' | 'remove';
  target: Material | undefined;
} | null>(null);
const file = shallowRef<File | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const actionError = ref('');
const busy = ref(false);
const uploading = ref(false);
const fileError = computed(() => (file.value ? materialFileError(file.value) : ''));
const number = new Intl.NumberFormat('uk', { maximumFractionDigits: 1 });
const fileSize = computed(() => {
  const bytes = file.value?.size ?? 0;
  if (bytes >= 1048576) return `${number.format(bytes / 1048576)} МіБ`;
  if (bytes >= 1024) return `${number.format(bytes / 1024)} КіБ`;
  return `${number.format(bytes)} Б`;
});
let staged: { file: File; versionId: number } | undefined;

const selected = shallowRef<{ material: Material; revisionId: number; offset: number } | null>(
  null,
);
const read = shallowRef<MaterialRead | null>(null);
const reading = ref(false);
const readError = ref('');
const downloading = ref(false);
const downloadError = ref('');
let readController: AbortController | undefined;
let extractionTimer: ReturnType<typeof setTimeout> | undefined;
const automaticChecks = ref(0);
const automaticCheckLimit = 12;

const query = ref('');
const submittedQuery = ref('');
const results = shallowRef<MaterialSearch | null>(null);
const searching = ref(false);
const searchError = ref('');
let searchController: AbortController | undefined;
let searchTimer: ReturnType<typeof setTimeout> | undefined;

const actionTitle = computed(
  () =>
    ({
      add: 'Додати матеріал',
      replace: 'Замінити матеріал',
      remove: 'Вилучити матеріал?',
    })[action.value?.type ?? 'add'],
);
const extracting = computed(
  () => read.value?.status === 'pending' || read.value?.status === 'running',
);
const extractionStatus = computed(() => {
  const material = read.value;
  if (!material || readError.value) return '';
  if (extracting.value) {
    if (automaticChecks.value > automaticCheckLimit) return 'Витяг тексту ще не готовий.';
    return 'Витягуємо текст…';
  }
  if (material.status === 'failed') {
    if (material.errorCode === 'NO_TEXT_LAYER') return 'PDF не містить текстового шару.';
    if (material.errorCode === 'PARSER_UNAVAILABLE')
      return 'Витяг тексту для цього файла недоступний.';
    return 'Не вдалося витягти текст.';
  }
  return !material.chunks.length ? 'Матеріал не містить тексту.' : '';
});

function showAction(type: 'add' | 'replace' | 'remove', target?: Material) {
  action.value = { type, target };
  file.value = null;
  staged = undefined;
  actionError.value = '';
}

function selectUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const picked = input.files?.[0];
  if (!picked) return;
  file.value = picked;
  input.value = '';
  actionError.value = '';
  staged = undefined;
}

async function apply() {
  const current = action.value;
  const input = file.value;
  if (!current || busy.value || props.locked) return;
  if (current.type !== 'remove' && (!input || materialFileError(input))) return;
  busy.value = true;
  actionError.value = '';
  try {
    if (input && staged?.file !== input) {
      uploading.value = true;
      const version = await api.upload(input, lifetime.signal);
      staged = { file: input, versionId: version.versionId };
      uploading.value = false;
    }
    lifetime.signal.throwIfAborted();
    const operation: MaterialChange =
      current.type === 'remove'
        ? { type: 'removeMaterial', materialId: current.target!.materialId }
        : current.type === 'replace'
          ? {
              type: 'replaceMaterial',
              materialId: current.target!.materialId,
              versionId: staged!.versionId,
              name: input!.name.normalize('NFC'),
            }
          : {
              type: 'attachMaterial',
              versionId: staged!.versionId,
              name: input!.name.normalize('NFC'),
            };
    if (await props.change(operation, current.target)) action.value = null;
    else actionError.value = 'Проєкт або матеріал змінився. Закрийте діалог і повторіть дію.';
  } catch (error) {
    if (lifetime.signal.aborted) return;
    actionError.value =
      error instanceof ApiError && error.code === 'MATERIAL_QUOTA_EXCEEDED'
        ? 'Досягнуто ліміту версій або сховища матеріалів.'
        : error instanceof ApiError && [400, 415, 422].includes(error.status)
          ? 'Перевірте формат і вміст вибраного файла.'
          : error instanceof ApiError && error.status === 413
            ? 'Файл перевищує доступний обсяг матеріалів.'
            : workspaceError(error, 'Не вдалося додати файл. Спробуйте ще раз.');
  } finally {
    uploading.value = false;
    busy.value = false;
  }
}

function clearRead() {
  readController?.abort();
  clearTimeout(extractionTimer);
  selected.value = null;
  read.value = null;
}

function openRead(material: Material, offset = 0) {
  clearRead();
  readError.value = '';
  downloadError.value = '';
  automaticChecks.value = 0;
  selected.value = { material, revisionId: props.revisionId, offset };
  readController = new AbortController();
  void loadRead();
}

async function loadRead(nextOffset?: number, background = false) {
  const item = selected.value;
  const signal = readController?.signal;
  if (!item || !signal || reading.value) return;
  clearTimeout(extractionTimer);
  reading.value = true;
  if (!background) readError.value = '';
  try {
    const page = await api.read(item.material, item.revisionId, nextOffset ?? item.offset, signal);
    if (signal.aborted) return;
    read.value = {
      ...page,
      chunks:
        nextOffset === undefined ? page.chunks : [...(read.value?.chunks ?? []), ...page.chunks],
    };
    if (extracting.value && automaticChecks.value++ < automaticCheckLimit)
      extractionTimer = setTimeout(() => {
        void loadRead(undefined, true);
      }, 4000);
  } catch (error) {
    if (!signal.aborted)
      readError.value = workspaceError(error, 'Перевірте з’єднання й повторіть спробу.');
  } finally {
    if (!signal.aborted) reading.value = false;
  }
}

watch(
  selected,
  (item) => {
    if (!item) {
      reading.value = false;
      downloading.value = false;
    }
  },
  { flush: 'sync' },
);

async function getOriginal() {
  const item = selected.value;
  const signal = readController?.signal;
  if (!item || !signal || downloading.value) return;
  downloading.value = true;
  downloadError.value = '';
  try {
    const blob = await api.download(item.material, item.revisionId, signal);
    if (!signal.aborted) props.download(blob, item.material.name);
  } catch (error) {
    if (!signal.aborted)
      downloadError.value = workspaceError(error, 'Не вдалося завантажити оригінал.');
  } finally {
    if (!signal.aborted) downloading.value = false;
  }
}

function clearSearch() {
  clearTimeout(searchTimer);
  searchController?.abort();
  submittedQuery.value = '';
  results.value = null;
  searching.value = false;
  searchError.value = '';
}

async function search(more = false) {
  const term = more ? submittedQuery.value : query.value.trim();
  const cursor = more ? results.value?.nextCursor : null;
  if (more && !cursor) return;
  if (!more) clearSearch();
  if (!term) return;
  searchController = new AbortController();
  const { signal } = searchController;
  submittedQuery.value = term;
  searching.value = true;
  searchError.value = '';
  try {
    const revision = more ? (results.value?.revisionId ?? props.revisionId) : props.revisionId;
    const page = await api.search(term, revision, cursor ?? null, signal);
    if (!signal.aborted)
      results.value = { ...page, matches: [...(results.value?.matches ?? []), ...page.matches] };
  } catch (error) {
    if (!signal.aborted) searchError.value = workspaceError(error, 'Не вдалося виконати пошук.');
  } finally {
    if (!signal.aborted) searching.value = false;
  }
}

function openMatch(match: MaterialSearch['matches'][number]) {
  const material = props.materials.find(
    (item) => item.materialId === match.materialId && item.versionId === match.versionId,
  );
  if (material) openRead(material, match.index);
}

const materialVersions = computed(() =>
  JSON.stringify(
    props.materials.map(({ materialId, versionId, name }) => [materialId, versionId, name]),
  ),
);
watch([() => query.value.trim(), materialVersions, () => props.active], ([term, , active]) => {
  clearSearch();
  if (active && term && props.materials.length) {
    submittedQuery.value = term;
    searching.value = true;
    searchTimer = setTimeout(() => void search(), 300);
  }
});
watch(
  () => props.active,
  (active) => {
    if (!active) {
      clearSearch();
      clearRead();
    }
  },
);
onBeforeUnmount(() => {
  lifetime.abort();
  clearRead();
  clearSearch();
});
</script>

<template>
  <section class="context-materials" aria-labelledby="context-materials-heading">
    <header class="materials-header">
      <h2 id="context-materials-heading">Матеріали</h2>
      <button
        type="button"
        class="button button-secondary"
        :disabled="locked"
        @click="showAction('add')"
      >
        Додати матеріал
      </button>
    </header>
    <p v-if="!materials.length" class="muted">Матеріалів поки немає.</p>
    <template v-else>
      <div class="material-search" role="search" aria-label="Пошук у матеріалах">
        <input
          v-model="query"
          type="search"
          maxlength="200"
          aria-label="Пошук у матеріалах"
          placeholder="Пошук у матеріалах"
        />
      </div>
      <p v-if="searching && !results" role="status">Пошук…</p>
      <p v-if="searchError" role="alert" class="field-error">{{ searchError }}</p>
      <button
        v-if="searchError && !results"
        type="button"
        class="button button-secondary"
        @click="search()"
      >
        Повторити пошук
      </button>
      <button v-if="submittedQuery" type="button" class="button button-quiet" @click="query = ''">
        До всіх матеріалів
      </button>
      <template v-if="results">
        <p v-if="!results.matches.length && !results.nextCursor" role="status">
          Збігів не знайдено.
        </p>
        <ul v-if="results.matches.length" class="material-extracts" aria-label="Результати пошуку">
          <li v-for="match in results.matches" :key="`${match.materialId}-${match.index}`">
            <button
              type="button"
              class="button button-quiet material-name"
              @click="openMatch(match)"
            >
              {{ match.name }}
            </button>
            <small v-if="chunkLocation(match)">{{ chunkLocation(match) }}</small>
            <p>{{ match.text }}</p>
          </li>
        </ul>
        <button
          v-if="results.nextCursor"
          type="button"
          class="button button-secondary"
          :disabled="searching"
          @click="search(true)"
        >
          Показати ще
        </button>
      </template>
      <ul v-if="!submittedQuery" class="materials-list">
        <li v-for="material in materials" :key="material.materialId">
          <button
            type="button"
            class="button button-quiet material-name"
            @click="openRead(material)"
          >
            {{ material.name }}
          </button>
          <div class="material-actions">
            <button
              type="button"
              class="button button-quiet"
              :disabled="locked"
              :aria-label="`Замінити матеріал ${material.name}`"
              @click="showAction('replace', material)"
            >
              Замінити
            </button>
            <button
              type="button"
              class="button button-quiet"
              :disabled="locked"
              :aria-label="`Вилучити матеріал ${material.name}`"
              @click="showAction('remove', material)"
            >
              Вилучити
            </button>
          </div>
        </li>
      </ul>
    </template>

    <ModalDialog
      :open="action !== null"
      :title="actionTitle"
      :busy="busy"
      dialog-class="material-dialog"
      @dismiss="action = null"
    >
      <form v-if="action" @submit.prevent="apply">
        <p v-if="action.type === 'remove'">
          «{{ action.target?.name }}» буде вилучено з поточної версії. Попередні версії збережуть
          матеріал.
        </p>
        <template v-else>
          <p v-if="action.target" class="material-current">
            Поточний файл: <strong>{{ action.target.name }}</strong>
          </p>
          <input
            ref="fileInput"
            type="file"
            :accept="materialAccept"
            :disabled="busy"
            aria-label="Файл матеріалу"
            hidden
            @change="selectUpload"
          />
          <div class="material-picker">
            <button
              type="button"
              class="button button-secondary"
              :disabled="busy"
              :aria-describedby="
                fileError ? 'context-material-file-error' : 'context-material-formats'
              "
              :autofocus="!file"
              @click="fileInput?.click()"
            >
              {{ file ? 'Вибрати інший файл' : 'Вибрати файл' }}
            </button>
            <div v-if="file" class="material-file-selection" role="status">
              <strong>{{ file.name }}</strong>
              <span>{{ fileSize }}</span>
            </div>
            <p v-if="fileError" id="context-material-file-error" class="field-error" role="alert">
              {{ fileError }}
            </p>
            <p id="context-material-formats" class="muted">
              TXT, MD, CSV, PDF або XLSX · до 10 МіБ
            </p>
          </div>
        </template>
        <p v-if="actionError" role="alert" class="field-error">{{ actionError }}</p>
        <div class="modal-actions">
          <button
            type="button"
            class="button button-secondary"
            :disabled="busy"
            @click="action = null"
          >
            Скасувати
          </button>
          <button
            type="submit"
            class="button"
            :class="action.type === 'remove' ? 'button-danger' : 'button-primary'"
            :disabled="busy || locked || (action.type !== 'remove' && (!file || !!fileError))"
          >
            {{
              busy
                ? uploading
                  ? 'Завантаження…'
                  : 'Збереження…'
                : { add: 'Додати', replace: 'Замінити', remove: 'Вилучити' }[action.type]
            }}
          </button>
        </div>
      </form>
    </ModalDialog>

    <ModalDialog
      :open="selected !== null"
      :title="selected?.material.name ?? 'Матеріал'"
      @dismiss="clearRead"
    >
      <p v-if="reading && !read" role="status">Завантаження матеріалу…</p>
      <LoadError
        v-if="readError"
        title="Не вдалося відкрити витяг"
        :message="readError"
        retry-label="Повторити"
        :retrying="reading"
        @retry="loadRead()"
      />
      <p v-if="extractionStatus" role="status">{{ extractionStatus }}</p>
      <ul
        v-if="read?.chunks.length"
        class="material-extracts material-extract-scroll"
        aria-label="Витягнутий текст"
      >
        <li v-for="chunk in read.chunks" :key="chunk.index">
          <small v-if="chunkLocation(chunk)">{{ chunkLocation(chunk) }}</small>
          <p>{{ chunk.text }}</p>
        </li>
      </ul>
      <button
        v-if="read?.nextOffset != null"
        type="button"
        class="button button-quiet"
        :disabled="reading"
        @click="loadRead(read.nextOffset)"
      >
        Показати ще
      </button>
      <button
        v-else-if="extracting && !readError && automaticChecks > automaticCheckLimit"
        type="button"
        class="button button-quiet"
        :disabled="reading"
        @click="loadRead()"
      >
        Перевірити стан
      </button>
      <p v-if="downloadError" role="alert" class="field-error">{{ downloadError }}</p>
      <div class="modal-actions">
        <button type="button" class="button button-secondary" @click="clearRead">Закрити</button>
        <button
          type="button"
          class="button button-primary"
          :disabled="downloading"
          @click="getOriginal"
        >
          Завантажити оригінал
        </button>
      </div>
    </ModalDialog>
  </section>
</template>

<style scoped>
.context-materials {
  padding: 14px 16px 20px;
  min-width: 0;
  border-top: 1px solid var(--color-border);
}
.material-current,
.material-file-selection {
  overflow-wrap: anywhere;
}
.material-picker {
  display: grid;
  justify-items: start;
  gap: 8px;
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-panel);
  background: var(--color-background);
}
.material-picker p {
  margin: 0;
  font-size: 13px;
}
.material-file-selection {
  display: grid;
  gap: 2px;
  min-width: 0;
  max-width: 100%;
}
.material-file-selection span {
  color: var(--color-muted);
  font-size: 13px;
}
@media (max-width: 480px) {
  .material-picker > button {
    width: 100%;
  }
}
.materials-header,
.materials-list li,
.material-search,
.material-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}
.materials-header,
.materials-list li {
  justify-content: space-between;
}
.materials-header h2 {
  margin: 0;
  font-size: 14px;
}
.materials-list,
.material-extracts {
  margin: 8px 0;
  padding: 0;
  list-style: none;
}
.materials-list li,
.material-extracts li {
  padding: 6px 0;
  border-bottom: 1px solid var(--color-border);
}
.material-name {
  min-width: 0;
  text-align: left;
  overflow-wrap: anywhere;
}
.material-extracts p {
  margin: 4px 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.material-search {
  margin-top: 12px;
}
.material-search input {
  flex: 1 1 12ch;
  min-width: 0;
  min-height: 40px;
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-text);
}
.material-extract-scroll {
  max-height: 45dvh;
  overflow: auto;
}
.context-materials dialog :is(input, p) {
  max-width: 100%;
}
</style>
