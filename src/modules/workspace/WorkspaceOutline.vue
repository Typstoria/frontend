<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue';
import ModalDialog from '../../shared/ui/ModalDialog.vue';
import { ApiError, type RequestOptions } from '../../shared/api/client';
import {
  loadSavedOutline,
  outlineSources,
  type OutlineFile,
  type OutlineNavigation,
  type OutlineTarget,
} from './workspace-outline';
import type { Snapshot, WorkspaceApi } from './workspace-api';

const props = defineProps<{
  open: boolean;
  projectId: number;
  snapshot: Snapshot;
  drafts: ReadonlyMap<number, string>;
  readText: WorkspaceApi['text'];
  request: (path: string, options?: RequestOptions) => Promise<unknown>;
}>();
const emit = defineEmits<{
  dismiss: [];
  navigate: [target: OutlineNavigation];
}>();

const status = ref<'loading' | 'ready' | 'error'>('loading');
const files = shallowRef<OutlineFile[]>([]);
const visibleFiles = computed(() => files.value.filter((file) => file.items.length));
const retry = ref(0);
let target: OutlineNavigation | undefined;

async function localOutline(
  snapshot: Snapshot,
  drafts: ReadonlyMap<number, string>,
  signal: AbortSignal,
) {
  const { createTypstOutlineParser } = await import('./typst-outline');
  const parser = await createTypstOutlineParser();
  try {
    const results: OutlineFile[] = [];
    const sources = outlineSources(snapshot);
    for (let index = 0; index < sources.length; index += 4) {
      signal.throwIfAborted();
      const batch = await Promise.all(
        sources.slice(index, index + 4).map(async ({ fileId, path }) => {
          const text =
            drafts.get(fileId) ??
            (await props.readText(props.projectId, fileId, snapshot.revision.id, signal)).content;
          return { fileId, path, text };
        }),
      );
      signal.throwIfAborted();
      results.push(
        ...batch.map(({ fileId, path, text }) => ({ fileId, path, items: parser.parse(text) })),
      );
    }
    return results;
  } finally {
    parser.close();
  }
}

watch(
  () => [props.open, props.snapshot.revision.id, props.drafts, retry.value] as const,
  async ([open], _, cleanup) => {
    if (!open) return;
    const { snapshot, drafts } = props;
    const controller = new AbortController();
    cleanup(() => controller.abort());
    status.value = 'loading';
    files.value = [];
    try {
      let result: OutlineFile[];
      if (drafts.size) result = await localOutline(snapshot, drafts, controller.signal);
      else {
        try {
          result = await loadSavedOutline(
            props.request,
            props.projectId,
            snapshot,
            controller.signal,
          );
        } catch (error) {
          if (
            !(error instanceof ApiError) ||
            !['EDITOR_UNAVAILABLE', 'EDITOR_QUOTA'].includes(error.code)
          )
            throw error;
          result = await localOutline(snapshot, drafts, controller.signal);
        }
      }
      if (controller.signal.aborted) return;
      files.value = result;
      status.value = 'ready';
    } catch {
      if (!controller.signal.aborted) status.value = 'error';
    }
  },
  { immediate: true },
);

function select(location: OutlineTarget) {
  const file = props.snapshot.tree.find((file) => file.fileId === location.fileId);
  if (!file) return;
  target = { ...location, sha256: file.sha256, draft: props.drafts.get(location.fileId) };
  emit('dismiss');
}

function afterClose() {
  if (target) emit('navigate', target);
  target = undefined;
}
</script>

<template>
  <ModalDialog
    :open="open"
    title="Структура документа"
    dialog-class="workspace-outline-dialog"
    @dismiss="emit('dismiss')"
    @closed="afterClose"
  >
    <p v-if="status === 'loading'" class="muted outline-message" role="status">
      Завантажуємо структуру…
    </p>
    <template v-else-if="status === 'error'">
      <p class="outline-message" role="alert">Не вдалося завантажити структуру документа.</p>
      <button type="button" class="button button-secondary" @click="retry++">Повторити</button>
    </template>
    <p v-else-if="!visibleFiles.length" class="muted outline-message">
      У документі ще немає заголовків.
    </p>
    <div v-else class="outline-files">
      <section v-for="file in visibleFiles" :key="file.fileId" class="outline-file">
        <h3>{{ file.path }}</h3>
        <ul>
          <li v-for="(item, index) in file.items" :key="index">
            <button
              type="button"
              :style="{ '--outline-depth': Math.min(item.depth, 4) }"
              @click="select({ fileId: file.fileId, position: item.position })"
            >
              <span>{{ item.label }}</span>
            </button>
          </li>
        </ul>
      </section>
    </div>
    <div class="modal-actions">
      <button type="button" class="button button-secondary" autofocus @click="emit('dismiss')">
        Закрити
      </button>
    </div>
  </ModalDialog>
</template>

<style scoped>
.outline-files {
  display: grid;
  gap: 12px;
  max-height: min(48dvh, 420px);
  overflow: auto;
  overscroll-behavior: contain;
}

.outline-file {
  min-width: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
}

.outline-file h3 {
  margin: 0;
  padding: 9px 12px;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-muted);
  background: var(--color-background);
  font: 12px var(--font-code);
  overflow-wrap: anywhere;
}

.outline-file ul {
  margin: 0;
  padding: 3px;
  list-style: none;
}

.outline-file button {
  display: block;
  width: 100%;
  min-height: 40px;
  padding: 6px 10px;
  padding-inline-start: calc(10px + var(--outline-depth) * 14px);
  border: none;
  border-radius: var(--radius-control);
  color: var(--color-text);
  background: transparent;
  font: inherit;
  text-align: start;
  overflow-wrap: anywhere;
  cursor: pointer;
}

.outline-file button:hover,
.outline-file button:focus-visible {
  background: var(--color-background);
}

.outline-file button:focus-visible {
  outline-offset: -2px;
}

.outline-message {
  margin: 0 0 12px;
}

@media (max-width: 720px) {
  .outline-file button {
    min-height: 44px;
  }
}
</style>
