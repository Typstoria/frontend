<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

export type WorkspaceTabId = number | 'context';
export type WorkspaceTab = {
  id: WorkspaceTabId;
  label: string;
  title?: string;
  dirty?: boolean;
};

const props = defineProps<{
  tabs: WorkspaceTab[];
  activeId: WorkspaceTabId | null;
}>();

const emit = defineEmits<{
  select: [id: WorkspaceTabId];
  close: [id: WorkspaceTabId];
  closeOthers: [id: WorkspaceTabId];
  closeRight: [id: WorkspaceTabId];
  closeAll: [];
  move: [id: WorkspaceTabId, toIndex: number];
}>();

const tabElements = new Map<WorkspaceTabId, HTMLButtonElement>();
const tabList = ref<HTMLElement | null>(null);
const menuElement = ref<HTMLElement | null>(null);
const menu = ref<{ id: WorkspaceTabId; x: number; y: number } | null>(null);
const menuTrigger = ref<HTMLElement | null>(null);
const draggedId = ref<WorkspaceTabId | null>(null);
const dropIndex = ref<number | null>(null);
const activeIndex = computed(() => {
  const index = props.tabs.findIndex((tab) => tab.id === props.activeId);
  return index >= 0 ? index : props.tabs.length ? 0 : -1;
});
const menuIndex = computed(() => props.tabs.findIndex((tab) => tab.id === menu.value?.id));

function revealTab(id: WorkspaceTabId) {
  const list = tabList.value;
  const tab = tabElements.get(id);
  if (!list || !tab) return;
  const listBounds = list.getBoundingClientRect();
  const tabBounds = tab.getBoundingClientRect();
  if (tabBounds.left < listBounds.left) list.scrollLeft -= listBounds.left - tabBounds.left;
  else if (tabBounds.right > listBounds.right)
    list.scrollLeft += tabBounds.right - listBounds.right;
}

watch(
  () => props.activeId,
  (id) => {
    if (id !== null) void nextTick(() => revealTab(id));
  },
);

function setTabElement(id: WorkspaceTabId, element: Element | null) {
  if (element instanceof HTMLButtonElement) tabElements.set(id, element);
  else tabElements.delete(id);
}

function focusTab(index: number) {
  const bounded = Math.max(0, Math.min(index, props.tabs.length - 1));
  const tab = props.tabs[bounded];
  if (!tab) return;
  emit('select', tab.id);
  void nextTick(() => {
    const element = tabElements.get(tab.id);
    element?.focus();
    revealTab(tab.id);
  });
}

function openMenu(id: WorkspaceTabId, x: number, y: number, trigger: HTMLElement) {
  menuTrigger.value = trigger;
  menu.value = { id, x, y };
  window.addEventListener('pointerdown', dismissOnOutsidePointer);
  void nextTick(() => {
    const panel = menuElement.value;
    if (!panel || menu.value?.id !== id) return;
    menu.value = {
      id,
      x: Math.max(8, Math.min(x, window.innerWidth - panel.offsetWidth - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - panel.offsetHeight - 8)),
    };
    void nextTick(() =>
      panel.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus(),
    );
  });
}

function closeMenu(restoreFocus = true) {
  window.removeEventListener('pointerdown', dismissOnOutsidePointer);
  const trigger = menuTrigger.value;
  menu.value = null;
  menuTrigger.value = null;
  if (restoreFocus && trigger?.isConnected) trigger.focus();
}

function dismissOnOutsidePointer(event: PointerEvent) {
  if (!(event.target instanceof Element) || event.target.closest('[role="menu"]')) return;
  closeMenu(false);
}

function dismissOnFocusOut(event: FocusEvent) {
  if (event.relatedTarget instanceof Node && menuElement.value?.contains(event.relatedTarget))
    return;
  closeMenu(false);
}

function onMenuKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    closeMenu();
    return;
  }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  const items = Array.from(
    menuElement.value?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? [],
  );
  if (!items.length) return;
  event.preventDefault();
  const currentIndex = items.indexOf(document.activeElement as HTMLElement);
  const nextIndex =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? items.length - 1
        : (currentIndex + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
  items[nextIndex]?.focus();
}

function onContextMenu(event: MouseEvent, id: WorkspaceTabId) {
  event.preventDefault();
  const wrapper = event.currentTarget;
  if (!(wrapper instanceof HTMLElement)) return;
  const trigger = wrapper.querySelector<HTMLElement>('[role="tab"]');
  if (trigger) openMenu(id, event.clientX, event.clientY, trigger);
}

function onTabKeydown(event: KeyboardEvent, index: number, id: WorkspaceTabId) {
  if (event.altKey && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
    event.preventDefault();
    const toIndex = index + (event.key === 'ArrowLeft' ? -1 : 1);
    if (toIndex >= 0 && toIndex < props.tabs.length) {
      emit('move', id, toIndex);
      void nextTick(() => {
        const element = tabElements.get(id);
        element?.focus();
        revealTab(id);
      });
    }
    return;
  }

  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    focusTab(index + (event.key === 'ArrowLeft' ? -1 : 1));
  } else if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault();
    focusTab(event.key === 'Home' ? 0 : props.tabs.length - 1);
  } else if (event.key === 'Delete') {
    event.preventDefault();
    emit('close', id);
  } else if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
    event.preventDefault();
    const target = event.currentTarget;
    if (target instanceof HTMLElement) {
      const rect = target.getBoundingClientRect();
      openMenu(id, rect.left, rect.bottom, target);
    }
  }
}

function onTabDragStart(event: DragEvent, id: WorkspaceTabId) {
  draggedId.value = id;
  event.dataTransfer?.setData('text/plain', String(id));
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
}

function onTabDragOver(event: DragEvent, index: number, id: WorkspaceTabId) {
  if (draggedId.value === null || draggedId.value === id) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  const element = tabElements.get(id)?.parentElement;
  const after = element
    ? event.clientX > element.getBoundingClientRect().left + element.offsetWidth / 2
    : false;
  dropIndex.value = index + Number(after);
}

function onTabDrop(event: DragEvent) {
  event.preventDefault();
  const id = draggedId.value;
  const targetIndex = dropIndex.value;
  if (id !== null && targetIndex !== null) {
    const sourceIndex = props.tabs.findIndex((tab) => tab.id === id);
    emit('move', id, targetIndex > sourceIndex ? targetIndex - 1 : targetIndex);
  }
  resetDrag();
}

function resetDrag() {
  draggedId.value = null;
  dropIndex.value = null;
}

function runMenuAction(action: 'close' | 'others' | 'right' | 'all') {
  const id = menu.value?.id;
  closeMenu(false);
  if (action === 'all') emit('closeAll');
  else if (id !== undefined && action === 'close') emit('close', id);
  else if (id !== undefined && action === 'others') emit('closeOthers', id);
  else if (id !== undefined && action === 'right') emit('closeRight', id);
}

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', dismissOnOutsidePointer);
});
</script>

<template>
  <div
    ref="tabList"
    class="workspace-tabs"
    role="tablist"
    aria-label="Відкриті файли"
    tabindex="-1"
  >
    <div
      v-for="(tab, index) in tabs"
      :key="tab.id"
      class="workspace-tab"
      :class="{
        'workspace-tab-active': tab.id === activeId,
        'workspace-tab-dragging': draggedId === tab.id,
        'workspace-tab-drop-before': dropIndex === index,
        'workspace-tab-drop-after': dropIndex === index + 1 && index === tabs.length - 1,
      }"
      role="presentation"
      draggable="true"
      @contextmenu="onContextMenu($event, tab.id)"
      @dragstart="onTabDragStart($event, tab.id)"
      @dragover="onTabDragOver($event, index, tab.id)"
      @drop="onTabDrop"
      @dragend="resetDrag"
    >
      <button
        :id="`workspace-tab-${tab.id}`"
        :ref="(element) => setTabElement(tab.id, element as Element | null)"
        type="button"
        class="workspace-tab-select"
        role="tab"
        :aria-selected="tab.id === activeId"
        :aria-label="tab.dirty ? `${tab.label}, незбережені зміни` : tab.label"
        aria-controls="workspace-tab-panel"
        :tabindex="index === activeIndex ? 0 : -1"
        :title="tab.title ?? tab.label"
        @click="emit('select', tab.id)"
        @keydown="onTabKeydown($event, index, tab.id)"
      >
        <span v-if="tab.id === 'context'" class="workspace-tab-context-icon" aria-hidden="true"
          >¶</span
        >
        <span v-else class="workspace-tab-file-icon" aria-hidden="true">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2">
            <path d="M4 2h5l3 3v9H4zM9 2v4h3" />
          </svg>
        </span>
        <span class="workspace-tab-label">{{ tab.label }}</span>
        <span v-if="tab.dirty" class="workspace-tab-dirty" aria-hidden="true">●</span>
      </button>
      <div class="workspace-tab-close-wrapper" role="presentation">
        <button
          type="button"
          class="workspace-tab-close"
          :aria-label="`Закрити ${tab.label}`"
          :title="`Закрити ${tab.label}`"
          @click="emit('close', tab.id)"
          @keydown.stop
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            aria-hidden="true"
          >
            <path d="m4 4 8 8m0-8-8 8" />
          </svg>
        </button>
      </div>
    </div>
    <div
      v-if="menu"
      ref="menuElement"
      class="workspace-tab-menu"
      role="menu"
      :style="{ left: `${menu.x}px`, top: `${menu.y}px` }"
      @mousedown.left.prevent
      @keydown="onMenuKeydown"
      @focusout="dismissOnFocusOut"
    >
      <button role="menuitem" type="button" @click="runMenuAction('close')">Закрити</button>
      <button
        role="menuitem"
        type="button"
        :disabled="tabs.length < 2"
        @click="runMenuAction('others')"
      >
        Закрити інші
      </button>
      <button
        role="menuitem"
        type="button"
        :disabled="menuIndex >= tabs.length - 1"
        @click="runMenuAction('right')"
      >
        Закрити праворуч
      </button>
      <button role="menuitem" type="button" @click="runMenuAction('all')">Закрити всі</button>
    </div>
  </div>
</template>

<style scoped>
.workspace-tabs {
  display: flex;
  flex: 1 1 auto;
  align-items: stretch;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
  overscroll-behavior-x: contain;
  background: #f8fafc;
}

.workspace-tab {
  position: relative;
  display: flex;
  flex: 0 0 auto;
  align-items: stretch;
  min-width: 104px;
  max-width: min(260px, 65vw);
  border-right: 1px solid var(--color-border);
  color: var(--color-muted);
}

.workspace-tab-active {
  background: var(--color-surface);
  color: var(--color-text);
}

.workspace-tab-select {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  min-width: 0;
  height: 38px;
  padding: 0 2px 0 10px;
  gap: 6px;
  border: 0;
  border-top: 2px solid transparent;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.workspace-tab-select:hover,
.workspace-tab-select:focus-visible {
  background: var(--color-surface);
  color: var(--color-text);
  outline: none;
}

.workspace-tab-active .workspace-tab-select {
  border-top-color: var(--color-primary);
  padding-top: 1px;
}

.workspace-tab-select:focus-visible {
  box-shadow: inset 0 0 0 2px var(--color-primary);
}

.workspace-tab-file-icon,
.workspace-tab-context-icon {
  display: grid;
  flex: 0 0 16px;
  place-items: center;
  color: #59758f;
}

.workspace-tab-file-icon svg {
  width: 16px;
  height: 16px;
}

.workspace-tab-context-icon {
  font-family: Georgia, serif;
  font-size: 17px;
}

.workspace-tab-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.workspace-tab-dirty {
  flex: 0 0 auto;
  color: var(--color-primary);
  font-size: 9px;
}

.workspace-tab-close-wrapper {
  display: flex;
  align-items: center;
  flex: 0 0 28px;
  padding-right: 3px;
}

.workspace-tab-close {
  display: grid;
  width: 26px;
  height: 26px;
  padding: 6px;
  place-items: center;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  opacity: 0;
}

.workspace-tab-active .workspace-tab-close,
.workspace-tab:hover .workspace-tab-close,
.workspace-tab:focus-within .workspace-tab-close {
  opacity: 1;
}

.workspace-tab-close:hover,
.workspace-tab-close:focus-visible {
  background: #e8f2f6;
  color: var(--color-primary);
  opacity: 1;
}

.workspace-tab-close svg {
  width: 14px;
  height: 14px;
}

.workspace-tab-dragging {
  opacity: 0.45;
}

.workspace-tab-drop-before::before,
.workspace-tab-drop-after::after {
  position: absolute;
  z-index: 2;
  top: 0;
  bottom: 0;
  width: 2px;
  content: '';
  background: var(--color-primary);
  pointer-events: none;
}

.workspace-tab-drop-before::before {
  left: 0;
}

.workspace-tab-drop-after::after {
  right: -1px;
}

.workspace-tab-menu {
  position: fixed;
  z-index: 100;
  display: grid;
  width: min(220px, calc(100vw - 20px));
  padding: 4px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  box-shadow: 0 8px 24px #102b4920;
}

.workspace-tab-menu button {
  min-height: 36px;
  padding: 7px 9px;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: var(--color-text);
  text-align: left;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.workspace-tab-menu button:hover,
.workspace-tab-menu button:focus-visible {
  background: var(--color-background);
  outline: none;
}

.workspace-tab-menu button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

@media (max-width: 720px) {
  .workspace-tab {
    min-width: 108px;
    max-width: 68vw;
  }

  .workspace-tab-select {
    height: 42px;
    padding-left: 8px;
  }

  .workspace-tab-close-wrapper {
    flex-basis: 34px;
    padding-right: 2px;
  }

  .workspace-tab-close {
    width: 32px;
    height: 32px;
    opacity: 1;
  }

  .workspace-tab-menu {
    left: 8px !important;
    right: 8px;
    bottom: 8px;
    top: auto !important;
    width: auto;
    padding: 8px;
  }

  .workspace-tab-menu button {
    min-height: 44px;
  }
}
</style>
