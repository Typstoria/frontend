<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';

const props = defineProps<{ disabled: boolean; uploadDisabled: boolean }>();
const emit = defineEmits<{ create: []; createDirectory: []; upload: [] }>();

const host = ref<HTMLDivElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);
const isOpen = ref(false);
const menuId = useId();

function enabledItems() {
  return Array.from(
    host.value?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [],
  );
}

async function openMenu(focusLast = false) {
  if (props.disabled) return;
  isOpen.value = true;
  await nextTick();
  const items = enabledItems();
  (focusLast ? items.at(-1) : items[0])?.focus();
}

function closeMenu(returnFocus = true) {
  isOpen.value = false;
  if (returnFocus) void nextTick(() => trigger.value?.focus({ preventScroll: true }));
}

function toggleMenu() {
  if (isOpen.value) closeMenu();
  else void openMenu();
}

function onTriggerKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    void openMenu();
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    void openMenu(true);
  }
}

function onMenuKeydown(event: KeyboardEvent) {
  const items = enabledItems();
  const index = items.indexOf(document.activeElement as HTMLButtonElement);
  let target: HTMLButtonElement | undefined;
  if (event.key === 'ArrowDown') target = items[(index + 1) % items.length];
  else if (event.key === 'ArrowUp') target = items[(index - 1 + items.length) % items.length];
  else if (event.key === 'Home') target = items[0];
  else if (event.key === 'End') target = items.at(-1);
  else return;

  event.preventDefault();
  target?.focus();
}

function onEscape(event: KeyboardEvent) {
  if (!isOpen.value) return;
  event.preventDefault();
  event.stopPropagation();
  closeMenu();
}

function onFocusOut(event: FocusEvent) {
  const next = event.relatedTarget;
  if (next !== trigger.value && next instanceof Node && host.value?.contains(next)) return;
  closeMenu(false);
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!isOpen.value || (event.target instanceof Node && host.value?.contains(event.target))) return;
  closeMenu(false);
}

function choose(action: 'create' | 'createDirectory' | 'upload') {
  closeMenu(false);
  trigger.value?.focus({ preventScroll: true });
  if (action === 'create') emit('create');
  else if (action === 'createDirectory') emit('createDirectory');
  else emit('upload');
}

watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) closeMenu(false);
  },
);

onMounted(() => document.addEventListener('pointerdown', onDocumentPointerDown, true));
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocumentPointerDown, true));
</script>

<template>
  <div ref="host" class="file-add-menu-host" @focusout="onFocusOut" @keydown.esc="onEscape">
    <button
      ref="trigger"
      class="file-icon-button"
      type="button"
      aria-label="Додати до проєкту"
      title="Додати до проєкту"
      aria-haspopup="menu"
      :aria-expanded="isOpen"
      :aria-controls="menuId"
      :disabled="disabled"
      @click="toggleMenu"
      @keydown="onTriggerKeydown"
    >
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        aria-hidden="true"
      >
        <path d="M10 4v12M4 10h12" />
      </svg>
    </button>
    <div
      v-show="isOpen"
      :id="menuId"
      class="file-add-menu"
      role="menu"
      aria-label="Додати до проєкту"
      @keydown="onMenuKeydown"
    >
      <button type="button" role="menuitem" tabindex="-1" @click="choose('create')">
        Створити файл
      </button>
      <button type="button" role="menuitem" tabindex="-1" @click="choose('createDirectory')">
        Створити папку
      </button>
      <button
        type="button"
        role="menuitem"
        tabindex="-1"
        :disabled="uploadDisabled"
        @click="choose('upload')"
      >
        Завантажити файл
      </button>
    </div>
  </div>
</template>

<style scoped>
.file-add-menu-host {
  position: relative;
  align-self: center;
}

.file-add-menu {
  position: absolute;
  z-index: 10;
  top: 100%;
  right: 0;
  width: 200px;
  padding: 4px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  box-shadow: 0 4px 14px rgb(15 23 42 / 14%);
}

.file-add-menu button {
  display: block;
  width: 100%;
  min-height: 40px;
  padding: 8px 10px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--color-text);
  text-align: left;
  cursor: pointer;
}

.file-add-menu button:hover:not(:disabled),
.file-add-menu button:focus-visible {
  background: #e8f2f6;
  outline: none;
}

.file-add-menu button:disabled {
  color: var(--color-muted);
  cursor: not-allowed;
}

@media (max-width: 720px) {
  .file-add-menu button {
    min-height: 44px;
  }
}
</style>
