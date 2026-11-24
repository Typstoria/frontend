<script setup lang="ts">
import { ref } from 'vue';

withDefaults(
  defineProps<{
    title: string;
    message?: string;
    variant?: 'page' | 'section';
    retryLabel?: string;
    retrying?: boolean;
  }>(),
  {
    variant: 'section',
    message: '',
    retryLabel: '',
  },
);

const emit = defineEmits<{ retry: [] }>();
const actions = ref<HTMLElement | null>(null);
defineExpose({
  focusAction: () =>
    actions.value?.querySelector<HTMLElement>('button:not(:disabled), a[href]')?.focus(),
});
</script>

<template>
  <div class="load-error" :class="`load-error-${variant}`">
    <div class="load-error-card">
      <div class="load-error-copy" role="alert">
        <component :is="variant === 'page' ? 'h1' : 'h2'">{{ title }}</component>
        <p v-if="message">{{ message }}</p>
      </div>
      <div v-if="retryLabel || $slots.actions" ref="actions" class="load-error-actions">
        <button
          v-if="retryLabel"
          type="button"
          class="button"
          :class="variant === 'page' ? 'button-primary' : 'button-secondary'"
          :disabled="retrying"
          @click="emit('retry')"
        >
          {{ retryLabel }}
        </button>
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.load-error {
  min-width: 0;
  overflow-wrap: anywhere;
}
.load-error-page {
  display: grid;
  flex: 1;
  align-items: safe center;
  justify-items: center;
  padding: clamp(16px, 4vw, 48px);
  overflow: auto;
  background: var(--color-background);
}
.load-error-card {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-panel);
  background: var(--color-surface);
}
.load-error-page .load-error-card {
  max-width: 30rem;
  padding: clamp(20px, 4vw, 32px);
}
.load-error-copy h1,
.load-error-copy h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 650;
}
.load-error-copy h1 {
  font-size: clamp(1.25rem, 2.5vw, 1.65rem);
}
.load-error-copy p {
  margin: 6px 0 0;
  color: var(--color-muted);
}
.load-error-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
.load-error-actions :slotted(a) {
  display: inline-flex;
  align-items: center;
}
</style>
