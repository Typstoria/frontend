<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import type { Snapshot } from './workspace-api';

const props = defineProps<{
  files: Snapshot['tree'];
  selectedId: number;
  selectedFolder: string | null;
  dirtyIds: number[];
  collapsedPaths: string[];
  mainFileId: number;
  disabled: boolean;
  replaceDisabled: boolean;
  mobile: boolean;
}>();
const emit = defineEmits<{
  select: [fileId: number];
  toggle: [path: string];
  selectFolder: [path: string];
  action: [
    kind: 'rename' | 'delete' | 'entrypoint' | 'replace',
    fileId: number,
    trigger: HTMLElement,
  ];
}>();

type FileTreeNode = { path: string; name: string; depth: number; file?: Snapshot['tree'][number] };
type ActionKind = 'rename' | 'delete' | 'entrypoint' | 'replace';
type OpenMenu = { fileId: number; trigger: HTMLElement };
const rows = computed(() => {
  const folders = new Map<string, FileTreeNode>();
  const children = new Map<string, FileTreeNode[]>();
  function append(parent: string, node: FileTreeNode) {
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
  const visible: FileTreeNode[] = [];
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

const openMenu = ref<OpenMenu | null>(null);
const menuElement = ref<HTMLElement | null>(null);
const menuPosition = ref({ left: 0, top: 0 });
const menuActions = computed(() => {
  const file = rows.value.find((node) => node.file?.fileId === openMenu.value?.fileId)?.file;
  if (!file) return [];
  const actions: { kind: ActionKind; label: string; disabled?: boolean }[] = [
    { kind: 'rename', label: 'Перейменувати файл', disabled: props.disabled },
    { kind: 'delete', label: 'Видалити файл', disabled: props.disabled },
  ];
  if (
    file.contentKind === 'text' &&
    file.path.endsWith('.typ') &&
    file.fileId !== props.mainFileId
  ) {
    actions.push({ kind: 'entrypoint', label: 'Зробити головним', disabled: props.disabled });
  }
  if (file.contentKind === 'binary') {
    actions.push({
      kind: 'replace',
      label: 'Замінити файл',
      disabled: props.disabled || props.replaceDisabled,
    });
  }
  return actions;
});

function clampMenuPosition(x: number, y: number) {
  const element = menuElement.value;
  if (!element) return;
  const rect = element.getBoundingClientRect();
  const margin = 8;
  menuPosition.value = {
    left: Math.max(margin, Math.min(x, window.innerWidth - rect.width - margin)),
    top: Math.max(margin, Math.min(y, window.innerHeight - rect.height - margin)),
  };
}

async function showMenu(fileId: number, trigger: HTMLElement, x: number, y: number) {
  if (props.disabled) return;
  openMenu.value = { fileId, trigger };
  await nextTick();
  if (openMenu.value?.fileId !== fileId) return;
  clampMenuPosition(x, y);
  document.addEventListener('pointerdown', onOutsidePointerDown, true);
  menuElement.value?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus();
}

function onContextMenu(node: FileTreeNode, event: MouseEvent) {
  if (!node.file || props.disabled) return;
  event.preventDefault();
  void showMenu(node.file.fileId, event.currentTarget as HTMLElement, event.clientX, event.clientY);
}

function onRowKeydown(node: FileTreeNode, event: KeyboardEvent) {
  if (!node.file || !((event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu'))
    return;
  event.preventDefault();
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  void showMenu(node.file.fileId, event.currentTarget as HTMLElement, rect.left, rect.bottom);
}

function dismissMenu(restoreFocus = false) {
  const current = openMenu.value;
  document.removeEventListener('pointerdown', onOutsidePointerDown, true);
  if (!current) return;
  openMenu.value = null;
  if (restoreFocus) void nextTick(() => current.trigger.isConnected && current.trigger.focus());
}

function onOutsidePointerDown(event: PointerEvent) {
  if (event.target instanceof Element && menuElement.value?.contains(event.target)) return;
  dismissMenu();
}

function onMenuKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    dismissMenu(true);
    return;
  }
  if (event.key === 'Tab') {
    const trigger = openMenu.value?.trigger;
    dismissMenu();
    trigger?.focus({ preventScroll: true });
    return;
  }
  const items = Array.from(
    menuElement.value?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [],
  );
  if (!items.length) return;
  const activeIndex = items.indexOf(document.activeElement as HTMLElement);
  let nextIndex: number | undefined;
  if (event.key === 'ArrowDown') nextIndex = (activeIndex + 1) % items.length;
  else if (event.key === 'ArrowUp') nextIndex = (activeIndex - 1 + items.length) % items.length;
  else if (event.key === 'Home') nextIndex = 0;
  else if (event.key === 'End') nextIndex = items.length - 1;
  if (nextIndex !== undefined) {
    event.preventDefault();
    items[nextIndex]?.focus();
  }
}

function onMenuFocusout(event: FocusEvent) {
  const next = event.relatedTarget;
  if (next instanceof Node && menuElement.value?.contains(next)) return;
  dismissMenu();
}

function runAction(kind: ActionKind) {
  const current = openMenu.value;
  if (!current) return;
  const { fileId, trigger } = current;
  document.removeEventListener('pointerdown', onOutsidePointerDown, true);
  openMenu.value = null;
  if (trigger.isConnected) trigger.focus();
  emit('action', kind, fileId, trigger);
}

function setMenuElement(element: Element | ComponentPublicInstance | null) {
  menuElement.value = element instanceof HTMLElement ? element : null;
}

function indentation(depth: number) {
  return Math.min(depth * 16, 96);
}

function openFromActionsButton(fileId: number, event: MouseEvent) {
  if (props.disabled) return;
  const trigger = event.currentTarget as HTMLElement;
  const rect = trigger.getBoundingClientRect();
  void showMenu(fileId, trigger, rect.right, rect.bottom);
}

watch(rows, (visibleRows) => {
  if (openMenu.value && !visibleRows.some((node) => node.file?.fileId === openMenu.value?.fileId)) {
    dismissMenu();
  }
});

onBeforeUnmount(() => document.removeEventListener('pointerdown', onOutsidePointerDown, true));
</script>

<template>
  <ul class="workspace-file-list">
    <li
      v-for="node in rows"
      :key="node.file ? `file-${node.file.fileId}` : `folder-${node.path}`"
      class="workspace-file-row"
    >
      <template v-if="node.file">
        <button
          type="button"
          class="workspace-file-tree-button"
          :style="{
            paddingLeft: `calc(${indentation(node.depth)}px + var(--file-disclosure-width) + 4px)`,
          }"
          :aria-label="node.path"
          :title="node.file.fileId === mainFileId ? `${node.path} — Головний файл` : node.path"
          :aria-description="node.file.fileId === mainFileId ? 'Головний файл' : undefined"
          :aria-current="node.file.fileId === selectedId ? 'true' : undefined"
          @click="emit('select', node.file.fileId)"
          @contextmenu="onContextMenu(node, $event)"
          @keydown="onRowKeydown(node, $event)"
        >
          <svg
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
          <span
            v-if="node.file.fileId === mainFileId || dirtyIds.includes(node.file.fileId)"
            class="file-markers"
          >
            <span
              v-if="dirtyIds.includes(node.file.fileId)"
              class="file-dirty"
              aria-label="Незбережені зміни"
              >●</span
            >
            <svg
              v-if="node.file.fileId === mainFileId"
              class="file-main-icon"
              viewBox="0 0 16 16"
              fill="currentColor"
              role="img"
              aria-label="Головний файл"
            >
              <title>Головний файл</title>
              <path
                d="m8 1.5 1.9 3.85 4.25.62-3.08 3 .73 4.23L8 11.2l-3.8 2 .73-4.23-3.08-3 4.25-.62L8 1.5Z"
              />
            </svg>
          </span>
        </button>
        <button
          v-if="mobile"
          type="button"
          class="workspace-file-actions-trigger"
          :aria-label="`Дії з файлом: ${node.path}`"
          aria-haspopup="menu"
          :aria-expanded="openMenu?.fileId === node.file.fileId"
          :disabled="disabled"
          @click="openFromActionsButton(node.file.fileId, $event)"
        >
          <span aria-hidden="true">•••</span>
        </button>
        <div
          v-if="openMenu?.fileId === node.file.fileId"
          :ref="setMenuElement"
          class="workspace-file-action-menu"
          role="menu"
          :style="{ left: `${menuPosition.left}px`, top: `${menuPosition.top}px` }"
          @keydown="onMenuKeydown"
          @focusout="onMenuFocusout"
        >
          <button
            v-for="action in menuActions"
            :key="action.kind"
            type="button"
            role="menuitem"
            tabindex="-1"
            :disabled="action.disabled"
            @click="runAction(action.kind)"
          >
            {{ action.label }}
          </button>
        </div>
      </template>
      <template v-else>
        <button
          type="button"
          class="workspace-folder-disclosure"
          :style="{ marginLeft: `${indentation(node.depth)}px` }"
          :aria-label="`${collapsedPaths.includes(node.path) ? 'Розгорнути' : 'Згорнути'} папку: ${node.path}`"
          :aria-expanded="!collapsedPaths.includes(node.path)"
          @click="emit('toggle', node.path)"
        >
          <svg
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
        </button>
        <button
          type="button"
          class="workspace-file-tree-button workspace-folder-name-button"
          :aria-label="node.path"
          :title="node.path"
          :aria-current="selectedFolder === node.path ? 'true' : undefined"
          @click="emit('selectFolder', node.path)"
        >
          <svg
            class="file-folder"
            :class="{ 'file-folder-open': !collapsedPaths.includes(node.path) }"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.2"
            aria-hidden="true"
          >
            <path
              v-if="collapsedPaths.includes(node.path)"
              d="M1.75 4.25h4l1.4 1.5h7.1v6.5H1.75z"
            />
            <path v-else d="M1.75 4.25h4l1.4 1.5h7.1l-1.15 6H1.75z" />
          </svg>
          <span class="workspace-file-name">{{ node.name }}</span>
        </button>
      </template>
    </li>
  </ul>
</template>

<style scoped>
.workspace-file-list {
  --file-disclosure-width: 28px;
}

.workspace-file-row {
  display: flex;
  align-items: stretch;
  min-width: 0;
  position: relative;
}

.workspace-file-tree-button {
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
}

.workspace-folder-name-button {
  padding-left: 4px;
}

.workspace-folder-disclosure,
.workspace-file-actions-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border: 0;
  background: transparent;
  color: var(--color-muted);
}

.workspace-folder-disclosure {
  flex: 0 0 var(--file-disclosure-width);
}

.workspace-folder-disclosure:hover,
.workspace-file-actions-trigger:hover:not(:disabled) {
  background: #edf2f6;
}

.workspace-file-actions-trigger {
  flex: 0 0 44px;
  min-height: 44px;
  font-size: 14px;
  letter-spacing: 1px;
}
.workspace-file-actions-trigger:disabled {
  opacity: 0.5;
}

.workspace-file-action-menu {
  position: fixed;
  z-index: 20;
  width: min(220px, calc(100vw - 16px));
  max-height: calc(100dvh - 16px);
  overflow-y: auto;
  padding: 4px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  box-shadow: 0 8px 24px rgb(22 48 72 / 18%);
}

.workspace-file-action-menu button {
  width: 100%;
  min-height: 36px;
  padding: 7px 10px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--color-text);
  text-align: left;
  overflow-wrap: anywhere;
  font-size: 13px;
}

.workspace-file-action-menu button:hover:not(:disabled),
.workspace-file-action-menu button:focus-visible {
  background: #edf2f6;
}

.workspace-file-action-menu button:disabled {
  color: var(--color-muted);
  cursor: not-allowed;
}

.file-folder,
.file-main-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.file-folder {
  color: var(--color-muted);
}

.file-markers {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  flex-shrink: 0;
}

.file-main-icon {
  width: 20px;
  height: 20px;
  color: var(--color-primary);
}

.file-symbol,
.file-chevron {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  color: var(--color-muted);
}

.file-chevron.collapsed {
  transform: rotate(-90deg);
}

@media (max-width: 720px) {
  .workspace-file-list {
    --file-disclosure-width: 44px;
  }
  .workspace-file-action-menu button {
    min-height: 44px;
  }
}
</style>
