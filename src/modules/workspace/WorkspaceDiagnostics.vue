<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Diagnostic } from './compilation-api';

type DiagnosticsResult = {
  jobId: number;
  revisionId: number;
  revisionNumber: number;
  items: Diagnostic[];
};

const props = defineProps<{
  result: DiagnosticsResult | null;
  canOpenFile: (item: Diagnostic, revisionId: number) => boolean;
}>();

const emit = defineEmits<{
  source: [item: Diagnostic, revisionId: number];
}>();

const panelState = ref<'closed' | 'auto' | 'manual'>('closed');
const isOpen = computed(() => panelState.value !== 'closed');
const items = computed(() => props.result?.items ?? []);

watch(
  () => [props.result?.jobId, props.result?.revisionId] as const,
  ([jobId, revisionId], previous) => {
    const isNewResult = jobId !== previous?.[0] || revisionId !== previous?.[1];
    if (!isNewResult || !jobId || panelState.value === 'manual') return;

    panelState.value = items.value.some((item) => item.severity === 'error') ? 'auto' : 'closed';
  },
  { immediate: true },
);

function toggle() {
  if (isOpen.value) {
    panelState.value = 'closed';
    return;
  }
  panelState.value = 'manual';
}

function openSource(item: Diagnostic) {
  if (props.result && props.canOpenFile(item, props.result.revisionId)) {
    emit('source', item, props.result.revisionId);
  }
}
</script>

<template>
  <section v-if="items.length || panelState === 'manual'" class="workspace-diagnostics">
    <button
      class="diagnostics-toggle"
      type="button"
      aria-controls="workspace-diagnostics-panel"
      :aria-expanded="isOpen"
      @click="toggle"
    >
      <span>Діагностика ({{ items.length }})</span>
      <span class="diagnostics-chevron" aria-hidden="true">{{ isOpen ? '⌄' : '⌃' }}</span>
    </button>

    <div
      v-if="isOpen"
      id="workspace-diagnostics-panel"
      class="diagnostics-panel"
      role="region"
      aria-label="Діагностика компіляції"
      tabindex="-1"
    >
      <p v-if="result" class="diagnostics-revision">Версія {{ result.revisionNumber }}</p>
      <p v-if="!items.length" class="diagnostics-empty">Немає діагностичних повідомлень.</p>
      <ul v-else>
        <li v-for="(item, index) in items" :key="index" :class="item.severity">
          <span class="diagnostic-severity">{{
            item.severity === 'error' ? 'Помилка' : 'Попередження'
          }}</span>
          <button
            v-if="result && canOpenFile(item, result.revisionId)"
            type="button"
            class="diagnostic-link"
            @click="openSource(item)"
          >
            {{ item.path ?? 'Відкрити файл' }}
          </button>
          <span v-else-if="item.path" class="diagnostic-path">{{ item.path }}</span>
          <p>{{ item.message }}</p>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.workspace-diagnostics {
  flex: 0 0 auto;
  min-width: 0;
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);
}

.diagnostics-toggle {
  display: flex;
  width: 100%;
  min-height: 36px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 12px;
  border: 0;
  background: transparent;
  color: var(--color-text, inherit);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}

.diagnostics-toggle:hover {
  background: #f8fafc;
}

.diagnostics-toggle:focus-visible,
.diagnostic-link:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

.diagnostics-chevron {
  color: var(--color-muted);
  font-size: 16px;
  line-height: 1;
}

.diagnostics-panel {
  max-height: min(34vh, 240px);
  overflow: auto;
  overscroll-behavior: contain;
  border-top: 1px solid var(--color-border);
}

.diagnostics-revision,
.diagnostics-empty {
  margin: 0;
  padding: 7px 12px;
  color: var(--color-muted);
  font-size: 12px;
}

.diagnostics-revision {
  border-bottom: 1px solid var(--color-border);
}

.diagnostics-empty {
  font-size: 13px;
}

.diagnostics-panel ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.diagnostics-panel li {
  padding: 7px 12px 9px;
  border-bottom: 1px solid var(--color-border);
  overflow-wrap: anywhere;
}

.diagnostics-panel li p {
  margin: 3px 0 0;
  font-size: 13px;
}

.diagnostic-severity {
  margin-right: 8px;
  color: #8b520c;
  font-size: 12px;
}

.error .diagnostic-severity {
  color: #9d302e;
}

.diagnostic-link,
.diagnostic-path {
  color: var(--color-muted);
  font: 12px var(--font-code);
}

.diagnostic-link {
  min-height: 34px;
  padding: 0 4px;
  border: 0;
  background: transparent;
  color: #006884;
  text-align: left;
  text-decoration: underline;
  overflow-wrap: anywhere;
  cursor: pointer;
}

@media (max-width: 720px) {
  .diagnostics-toggle {
    min-height: 44px;
  }

  .diagnostic-link {
    min-height: 44px;
  }

  .diagnostics-panel {
    max-height: min(40vh, 240px);
  }
}
</style>
