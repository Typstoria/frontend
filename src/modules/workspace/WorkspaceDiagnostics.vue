<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Diagnostic } from './compilation-api';
import WorkspaceSeparator from './WorkspaceSeparator.vue';

type DiagnosticsResult = {
  revisionId: number;
  revisionNumber: number;
  items: Diagnostic[];
};

const props = defineProps<{
  result: DiagnosticsResult | null;
  canOpenFile: (item: Diagnostic, revisionId: number) => boolean;
  height?: number | null;
  maxHeight?: number;
}>();

const emit = defineEmits<{
  source: [item: Diagnostic, revisionId: number];
  resize: [height: number | null];
}>();

const isOpen = defineModel<boolean>('open', { required: true });
const items = computed(() => props.result?.items ?? []);
const naturalContent = ref<HTMLElement | null>(null);
const naturalHeight = ref(0);
const viewportHeight = ref(typeof window === 'undefined' ? 800 : window.innerHeight);
const viewportWidth = ref(typeof window === 'undefined' ? 1024 : window.innerWidth);
const minHeight = 64;
const naturalMaxHeight = computed(() =>
  Math.max(
    0,
    Math.min(
      props.maxHeight ?? 240,
      240,
      viewportHeight.value * (viewportWidth.value <= 720 ? 0.4 : 0.34),
    ),
  ),
);
const effectiveMaxHeight = computed(() => props.maxHeight ?? 240);
const currentHeight = computed(() => {
  const requested = props.height ?? naturalHeight.value;
  return Math.min(effectiveMaxHeight.value, Math.max(minHeight, requested || minHeight));
});
const canResize = computed(() => effectiveMaxHeight.value > minHeight);
let panelObserver: ResizeObserver | null = null;

function updateViewportHeight() {
  viewportHeight.value = window.innerHeight;
  viewportWidth.value = window.innerWidth;
}

function observePanel() {
  panelObserver?.disconnect();
  if (!naturalContent.value) return;
  panelObserver = new ResizeObserver(([entry]) => {
    if (entry) {
      naturalHeight.value = Math.min(
        naturalMaxHeight.value,
        Math.max(minHeight, entry.contentRect.height),
      );
    }
  });
  panelObserver.observe(naturalContent.value);
}

watch(naturalContent, observePanel, { flush: 'post' });
watch(naturalMaxHeight, (maxHeight) => {
  if (naturalContent.value) {
    naturalHeight.value = Math.min(
      maxHeight,
      Math.max(minHeight, naturalContent.value.getBoundingClientRect().height),
    );
  }
});

onMounted(() => {
  window.addEventListener('resize', updateViewportHeight);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateViewportHeight);
  panelObserver?.disconnect();
});

watch(
  () => props.result,
  () => {
    isOpen.value = items.value.some((item) => item.severity === 'error');
  },
  { immediate: true },
);

function openSource(item: Diagnostic) {
  if (props.result && props.canOpenFile(item, props.result.revisionId)) {
    emit('source', item, props.result.revisionId);
  }
}
</script>

<template>
  <section v-if="items.length" class="workspace-diagnostics">
    <WorkspaceSeparator
      v-if="isOpen && canResize"
      label="Висота діагностики"
      controls="workspace-diagnostics-panel"
      orientation="horizontal"
      :value="currentHeight"
      :min="minHeight"
      :max="effectiveMaxHeight"
      inverted
      @change="emit('resize', $event)"
      @reset="emit('resize', null)"
    />

    <button
      class="diagnostics-toggle"
      type="button"
      aria-controls="workspace-diagnostics-panel"
      :aria-expanded="isOpen"
      @click="isOpen = !isOpen"
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
      :style="{
        '--diagnostics-max-height': `${props.height == null ? naturalMaxHeight : effectiveMaxHeight}px`,
        height: props.height == null ? undefined : `${currentHeight}px`,
      }"
    >
      <div ref="naturalContent" class="diagnostics-content">
        <p v-if="result" class="diagnostics-revision">Версія {{ result.revisionNumber }}</p>
        <ul>
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
    </div>
  </section>
</template>

<style scoped>
.workspace-diagnostics {
  display: flex;
  flex-direction: column;
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
  max-height: var(--diagnostics-max-height, 240px);
  min-height: min(64px, var(--diagnostics-max-height, 240px));
  overflow: auto;
  overscroll-behavior: contain;
  border-top: 1px solid var(--color-border);
}

.diagnostics-revision {
  margin: 0;
  padding: 7px 12px;
  color: var(--color-muted);
  font-size: 12px;
  border-bottom: 1px solid var(--color-border);
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
}
</style>
