<script setup lang="ts">
import { nextTick, onMounted, ref, useId, watch } from 'vue';

const props = defineProps<{
  kind: 'create' | 'createDirectory' | 'rename' | 'renameDirectory';
  name: string;
  error: string;
  busy: boolean;
  locked: boolean;
  retryLabel?: string | undefined;
}>();
const emit = defineEmits<{
  input: [name: string];
  submit: [];
  cancel: [];
  retry: [];
}>();

const input = ref<HTMLInputElement | null>(null);
const retry = ref<HTMLButtonElement | null>(null);
const errorId = useId();
const directory = () => props.kind === 'createDirectory' || props.kind === 'renameDirectory';
const label = () => (directory() ? 'Назва папки' : 'Назва файла');
const submitLabel = () =>
  props.kind === 'create' || props.kind === 'createDirectory' ? 'Створити' : 'Зберегти';

function focusAndSelectName() {
  const element = input.value;
  if (!element) return;
  element.focus({ preventScroll: true });
  element.scrollIntoView({ block: 'nearest' });
  const dot = props.name.lastIndexOf('.');
  const end = !directory() && dot > 0 ? dot : props.name.length;
  element.setSelectionRange(0, end);
}

function submitName(event: KeyboardEvent) {
  if (event.isComposing) return;
  event.preventDefault();
  if (!props.busy) emit('submit');
}
function cancelName(event: KeyboardEvent) {
  if (event.isComposing) return;
  event.preventDefault();
  event.stopPropagation();
  if (!props.busy) emit('cancel');
}

onMounted(() => void nextTick(focusAndSelectName));
watch(
  () => props.busy,
  async (busy) => {
    if (busy) return;
    await nextTick();
    if (document.activeElement === document.body)
      (props.locked ? retry.value : input.value)?.focus({ preventScroll: true });
  },
);
</script>

<template>
  <div
    class="workspace-inline-name"
    :class="{ 'workspace-inline-name-locked': locked }"
    @keydown.esc="cancelName"
  >
    <template v-if="locked">
      <p v-if="error" :id="errorId" class="workspace-inline-name-error" role="alert">{{ error }}</p>
      <button
        v-if="retryLabel"
        ref="retry"
        type="button"
        class="workspace-inline-name-button workspace-inline-name-retry"
        :disabled="busy"
        @click="emit('retry')"
      >
        {{ retryLabel }}
      </button>
      <button
        type="button"
        class="workspace-inline-name-button"
        :disabled="busy"
        @click="emit('cancel')"
      >
        Закрити
      </button>
    </template>
    <template v-else>
      <label class="workspace-inline-name-field">
        <span class="visually-hidden">{{ label() }}</span>
        <input
          ref="input"
          :value="name"
          :placeholder="directory() ? 'Назва папки' : 'Назва файла'"
          :aria-invalid="error ? 'true' : undefined"
          :aria-describedby="error ? errorId : undefined"
          :disabled="busy"
          autocomplete="off"
          spellcheck="false"
          @input="emit('input', ($event.target as HTMLInputElement).value)"
          @keydown.enter="submitName"
        />
      </label>
      <button
        type="button"
        class="workspace-inline-name-button workspace-inline-name-submit"
        :aria-label="submitLabel()"
        :title="submitLabel()"
        :disabled="busy || !name.trim()"
        @click="emit('submit')"
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          aria-hidden="true"
        >
          <path d="m3 8 3.2 3.2L13 4.5" />
        </svg>
      </button>
      <button
        type="button"
        class="workspace-inline-name-button workspace-inline-name-cancel"
        aria-label="Скасувати"
        title="Скасувати"
        :disabled="busy"
        @click="emit('cancel')"
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          aria-hidden="true"
        >
          <path d="m4 4 8 8m0-8-8 8" />
        </svg>
      </button>
      <p v-if="error" :id="errorId" class="workspace-inline-name-error" role="alert">{{ error }}</p>
    </template>
  </div>
</template>

<style scoped>
.workspace-inline-name {
  display: flex;
  flex: 1 1 auto;
  flex-wrap: wrap;
  align-items: center;
  min-width: 0;
  gap: 4px;
  padding: 4px;
}

.workspace-inline-name-field {
  flex: 1 1 0;
  min-width: 0;
}

.workspace-inline-name-field input {
  display: block;
  width: 100%;
  min-width: 0;
  min-height: 32px;
  padding: 5px 8px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-size: 13px;
}

.workspace-inline-name-field input:focus-visible {
  border-color: var(--color-primary);
  outline: 2px solid color-mix(in srgb, var(--color-primary) 25%, transparent);
  outline-offset: 1px;
}

.workspace-inline-name-button {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  min-height: 32px;
  padding: 5px 7px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--color-muted);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.workspace-inline-name-button svg {
  width: 16px;
  height: 16px;
}

.workspace-inline-name-submit {
  gap: 4px;
  background: #e8f2f6;
  color: var(--color-primary);
}

.workspace-inline-name-button:hover:not(:disabled) {
  background: #edf2f6;
  color: var(--color-text);
}

.workspace-inline-name-submit:hover:not(:disabled) {
  background: #dcecf2;
  color: var(--color-primary);
}

.workspace-inline-name-button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.workspace-inline-name-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.workspace-inline-name-error {
  flex: 1 0 100%;
  min-width: 0;
  margin: 0;
  padding: 3px 5px;
  color: #a33b32;
  font-size: 12px;
  line-height: 1.4;
}

.workspace-inline-name-locked {
  flex-wrap: wrap;
}

.workspace-inline-name-retry {
  color: var(--color-primary);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

@media (max-width: 720px) {
  .workspace-inline-name-button {
    min-height: 40px;
  }

  .workspace-inline-name-field input {
    min-height: 40px;
  }
}
</style>
