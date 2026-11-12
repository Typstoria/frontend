<script setup lang="ts">
import { computed } from 'vue';
import type { Snapshot } from './workspace-api';

const props = defineProps<{
  files: Snapshot['tree'];
  selectedId: number;
  dirtyIds: number[];
  collapsedPaths: string[];
  mainFileId: number;
}>();
const emit = defineEmits<{ select: [fileId: number]; toggle: [path: string] }>();
type Node = { path: string; name: string; depth: number; file?: Snapshot['tree'][number] };
const rows = computed(() => {
  const folders = new Map<string, Node>();
  const children = new Map<string, Node[]>();
  function append(parent: string, node: Node) {
    const list = children.get(parent) ?? [];
    list.push(node);
    children.set(parent, list);
  }
  for (const file of props.files) {
    const parts = file.path.split('/');
    let parent = '';
    for (let index = 0; index < parts.length - 1; index++) {
      const path = parts.slice(0, index + 1).join('/');
      if (!folders.has(path)) {
        const folder = { path, name: parts[index]!, depth: index };
        folders.set(path, folder);
        append(parent, folder);
      }
      parent = path;
    }
    append(parent, { path: file.path, name: parts.at(-1)!, depth: parts.length - 1, file });
  }
  const visible: Node[] = [];
  function visit(parent: string) {
    const list = children.get(parent) ?? [];
    list.sort(
      (a, b) =>
        Number(Boolean(a.file)) - Number(Boolean(b.file)) || a.name.localeCompare(b.name, 'uk'),
    );
    for (const node of list) {
      visible.push(node);
      if (!node.file && !props.collapsedPaths.includes(node.path)) visit(node.path);
    }
  }
  visit('');
  return visible;
});
</script>

<template>
  <ul class="workspace-file-list">
    <li v-for="node in rows" :key="node.path">
      <button
        :style="{ paddingLeft: `${12 + node.depth * 16}px` }"
        :aria-label="node.path"
        :title="node.path"
        :aria-current="node.file?.fileId === selectedId ? 'true' : undefined"
        :aria-expanded="!node.file ? !collapsedPaths.includes(node.path) : undefined"
        @click="node.file ? emit('select', node.file.fileId) : emit('toggle', node.path)"
      >
        <svg
          v-if="!node.file"
          class="file-chevron"
          :class="{ collapsed: collapsedPaths.includes(node.path) }"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          aria-hidden="true"
        >
          <path d="m5 6 3 3 3-3" />
        </svg>
        <svg
          v-else
          class="file-symbol"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.2"
          aria-hidden="true"
        >
          <path d="M4 2h5l3 3v9H4zM9 2v4h3" />
        </svg>
        <span class="workspace-file-name">{{ node.name }}</span>
        <span v-if="node.file?.fileId === mainFileId" class="file-main" aria-label="Головний файл"
          >головний</span
        >
        <span
          v-if="node.file && dirtyIds.includes(node.file.fileId)"
          class="file-dirty"
          aria-label="Незбережені зміни"
          >●</span
        >
      </button>
    </li>
  </ul>
</template>
