<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';

export type WorkspaceMainMenuItem = {
  id: string;
  label: string;
  disabled?: boolean;
  checked?: boolean;
  danger?: boolean;
  separatorBefore?: boolean;
};

export type WorkspaceMainMenuGroup = {
  label: string;
  items: WorkspaceMainMenuItem[];
};

const props = defineProps<{ groups: WorkspaceMainMenuGroup[] }>();
const emit = defineEmits<{ command: [id: string, trigger: HTMLElement] }>();

const host = ref<HTMLElement | null>(null);
const panel = ref<HTMLElement | null>(null);
const mobileTrigger = ref<HTMLButtonElement | null>(null);
const isOpen = ref(false);
const isMobile = ref(
  typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches,
);
const activeGroup = ref(0);
const panelPosition = ref({ left: 8, top: 8, maxHeight: 0 });
const menuId = useId();
const desktopTriggers = new Map<number, HTMLButtonElement>();

function setDesktopTrigger(index: number, element: Element | null) {
  if (element instanceof HTMLButtonElement) desktopTriggers.set(index, element);
  else desktopTriggers.delete(index);
}

function getTrigger(): HTMLElement | null {
  return isMobile.value ? mobileTrigger.value : (desktopTriggers.get(activeGroup.value) ?? null);
}

function enabledItems() {
  return Array.from(
    panel.value?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"])') ??
      [],
  );
}

async function positionPanel(trigger: HTMLElement) {
  await nextTick();
  const popup = panel.value;
  if (!popup || !isOpen.value) return;
  const bounds = trigger.getBoundingClientRect();
  const width = popup.offsetWidth;
  const gap = 4;
  let left = bounds.left;
  if (left + width > window.innerWidth - 8) left = bounds.right - width;
  left = Math.max(8, Math.min(left, window.innerWidth - width - 8));

  const availableBelow = window.innerHeight - bounds.bottom - gap - 8;
  const availableAbove = bounds.top - gap - 8;
  const height = popup.scrollHeight + 2;
  const above = availableBelow < Math.min(height, 220) && availableAbove > availableBelow;
  const maxHeight = Math.max(0, above ? availableAbove : availableBelow);
  const top = above ? bounds.top - gap - Math.min(height, maxHeight) : bounds.bottom + gap;
  panelPosition.value = { left, top, maxHeight };
}

async function openMenu(groupIndex: number, focusLast = false) {
  if (!props.groups.length) return;
  activeGroup.value = Math.max(0, Math.min(groupIndex, props.groups.length - 1));
  isOpen.value = true;
  const trigger = getTrigger();
  if (!trigger) return;
  await positionPanel(trigger);
  const items = enabledItems();
  (focusLast ? items.at(-1) : items[0])?.focus();
}

function closeMenu(restoreFocus = false) {
  if (!isOpen.value) return;
  isOpen.value = false;
  if (restoreFocus) {
    const trigger = getTrigger();
    void nextTick(() => trigger?.focus({ preventScroll: true }));
  }
}

function toggleMenu(groupIndex: number) {
  if (isOpen.value && activeGroup.value === groupIndex) closeMenu();
  else void openMenu(groupIndex);
}

function onTriggerKeydown(event: KeyboardEvent, groupIndex: number) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    void openMenu(groupIndex, event.key === 'ArrowUp');
  } else if (!isMobile.value && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
    if (!props.groups.length) return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const next = (groupIndex + direction + props.groups.length) % props.groups.length;
    desktopTriggers.get(next)?.focus();
  }
}

function onMenuKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    closeMenu(true);
    return;
  }

  if (!['ArrowDown', 'ArrowUp', 'Home', 'End', 'ArrowLeft', 'ArrowRight'].includes(event.key))
    return;
  const items = enabledItems();
  if (!items.length) return;

  if (!isMobile.value && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
    if (props.groups.length < 2) return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    void openMenu((activeGroup.value + direction + props.groups.length) % props.groups.length);
    return;
  }

  event.preventDefault();
  const index = items.indexOf(document.activeElement as HTMLElement);
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? items.length - 1
        : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
  items[next]?.focus();
}

function choose(item: WorkspaceMainMenuItem) {
  if (item.disabled) return;
  const trigger = getTrigger();
  if (!trigger) return;
  closeMenu();
  emit('command', item.id, trigger);
}

function onFocusOut(event: FocusEvent) {
  if (event.relatedTarget instanceof Node && host.value?.contains(event.relatedTarget)) return;
  closeMenu();
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!isOpen.value || (event.target instanceof Node && host.value?.contains(event.target))) return;
  closeMenu();
}

function updateViewport() {
  const nextMobile = window.matchMedia('(max-width: 720px)').matches;
  if (nextMobile !== isMobile.value) {
    closeMenu();
    isMobile.value = nextMobile;
  } else if (isOpen.value) {
    const trigger = getTrigger();
    if (trigger) void positionPanel(trigger);
  }
}

watch(
  () => props.groups.length,
  (length) => {
    if (!length) closeMenu();
    else if (activeGroup.value >= length) activeGroup.value = length - 1;
  },
);

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown, true);
  window.addEventListener('resize', updateViewport);
});
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown, true);
  window.removeEventListener('resize', updateViewport);
});
</script>

<template>
  <div ref="host" class="workspace-main-menu" @focusout="onFocusOut">
    <nav class="workspace-main-menu-desktop" aria-label="Меню робочого простору">
      <button
        v-for="(group, index) in groups"
        :key="group.label"
        :ref="(element) => setDesktopTrigger(index, element as Element | null)"
        class="workspace-main-menu-trigger"
        type="button"
        aria-haspopup="menu"
        :aria-expanded="isOpen && !isMobile && activeGroup === index"
        :aria-controls="menuId"
        @click="toggleMenu(index)"
        @keydown="onTriggerKeydown($event, index)"
      >
        {{ group.label }}
      </button>
    </nav>
    <button
      ref="mobileTrigger"
      class="workspace-main-menu-trigger workspace-main-menu-mobile-trigger"
      type="button"
      aria-haspopup="menu"
      :aria-expanded="isOpen && isMobile"
      :aria-controls="menuId"
      @click="toggleMenu(activeGroup)"
      @keydown="onTriggerKeydown($event, activeGroup)"
    >
      Меню
    </button>

    <div
      v-show="isOpen"
      :id="menuId"
      ref="panel"
      class="workspace-main-menu-panel"
      role="menu"
      :aria-label="isMobile ? 'Меню проєкту' : groups[activeGroup]?.label"
      :style="{
        left: `${panelPosition.left}px`,
        top: `${panelPosition.top}px`,
        maxHeight: panelPosition.maxHeight ? `${panelPosition.maxHeight}px` : undefined,
      }"
      @keydown="onMenuKeydown"
    >
      <template v-if="isMobile">
        <template v-for="group in groups" :key="group.label">
          <div class="workspace-main-menu-group-label" role="presentation">{{ group.label }}</div>
          <template v-for="item in group.items" :key="item.id">
            <div
              v-if="item.separatorBefore"
              class="workspace-main-menu-separator"
              role="separator"
            />
            <button
              type="button"
              :role="item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'"
              class="workspace-main-menu-item"
              :class="{ 'workspace-main-menu-item-danger': item.danger }"
              :aria-disabled="item.disabled || undefined"
              :aria-checked="item.checked"
              tabindex="-1"
              @click="choose(item)"
            >
              {{ item.label }}
              <span v-if="item.checked" class="workspace-main-menu-check" aria-hidden="true"
                >✓</span
              >
            </button>
          </template>
        </template>
      </template>
      <template v-else>
        <template v-for="item in groups[activeGroup]?.items ?? []" :key="item.id">
          <div v-if="item.separatorBefore" class="workspace-main-menu-separator" role="separator" />
          <button
            type="button"
            :role="item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'"
            class="workspace-main-menu-item"
            :class="{ 'workspace-main-menu-item-danger': item.danger }"
            :aria-disabled="item.disabled || undefined"
            :aria-checked="item.checked"
            tabindex="-1"
            @click="choose(item)"
          >
            {{ item.label }}
            <span v-if="item.checked" class="workspace-main-menu-check" aria-hidden="true">✓</span>
          </button>
        </template>
      </template>
    </div>
  </div>
</template>

<style scoped>
.workspace-main-menu {
  display: flex;
  align-items: center;
  align-self: center;
  min-width: 0;
}

.workspace-main-menu-desktop {
  display: flex;
  align-items: center;
  gap: 2px;
}

.workspace-main-menu-trigger {
  min-height: 32px;
  padding: 5px 9px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--color-text);
  font: inherit;
  font-size: 13px;
  line-height: 1.4;
  cursor: pointer;
}

.workspace-main-menu-trigger:hover,
.workspace-main-menu-trigger[aria-expanded='true'] {
  background: #e8f2f6;
}

.workspace-main-menu-trigger:focus-visible,
.workspace-main-menu-item:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.workspace-main-menu-mobile-trigger {
  display: none;
}

.workspace-main-menu-panel {
  position: fixed;
  z-index: 100;
  min-width: 190px;
  max-width: min(280px, calc(100vw - 16px));
  max-height: calc(100dvh - 16px);
  overflow: auto;
  padding: 4px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  box-shadow: 0 4px 14px rgb(15 23 42 / 14%);
}

.workspace-main-menu-group-label {
  padding: 8px 10px 4px;
  color: var(--color-muted);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
}

.workspace-main-menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-height: 36px;
  padding: 7px 10px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--color-text);
  font: inherit;
  font-size: 13px;
  line-height: 1.4;
  text-align: left;
  cursor: pointer;
}
.workspace-main-menu-check {
  color: var(--color-primary);
}

.workspace-main-menu-item:hover:not([aria-disabled='true']),
.workspace-main-menu-item:focus-visible {
  background: #e8f2f6;
}

.workspace-main-menu-item[aria-disabled='true'] {
  color: var(--color-muted);
  cursor: not-allowed;
}

.workspace-main-menu-item-danger {
  color: #a33b32;
}

.workspace-main-menu-item-danger:hover:not([aria-disabled='true']),
.workspace-main-menu-item-danger:focus-visible {
  background: #fff0ee;
}

.workspace-main-menu-separator {
  height: 1px;
  margin: 4px 6px;
  background: var(--color-border);
}

@media (max-width: 720px) {
  .workspace-main-menu-desktop {
    display: none;
  }

  .workspace-main-menu-mobile-trigger {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
  }

  .workspace-main-menu-panel {
    min-width: 216px;
  }

  .workspace-main-menu-item {
    min-height: 44px;
  }
}
</style>
