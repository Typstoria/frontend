<script setup lang="ts">
import { computed, ref } from 'vue';

const props = withDefaults(
  defineProps<{
    label: string;
    controls: string;
    orientation: 'vertical' | 'horizontal';
    value: number;
    min: number;
    max: number;
    defaultValue?: number | undefined;
    inverted?: boolean;
  }>(),
  { defaultValue: undefined, inverted: false },
);

const emit = defineEmits<{
  change: [value: number];
  reset: [];
}>();

const separator = ref<HTMLElement | null>(null);
const dragStart = ref<{ pointerId: number; coordinate: number; value: number } | null>(null);
const ariaValue = computed(() => Math.round(clamp(props.value)));

function clamp(value: number) {
  return Math.min(props.max, Math.max(props.min, value));
}

function changeBy(delta: number) {
  emit('change', clamp(props.value + delta));
}

function onKeydown(event: KeyboardEvent) {
  const increment = props.inverted ? 16 : -16;
  if (props.orientation === 'horizontal') {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      changeBy(increment);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      changeBy(-increment);
    }
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    changeBy(-increment);
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault();
    changeBy(increment);
  }

  if (event.key === 'Home') {
    event.preventDefault();
    emit('change', props.min);
  } else if (event.key === 'End') {
    event.preventDefault();
    emit('change', props.max);
  }
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0 || !separator.value) return;

  event.preventDefault();
  separator.value.focus();
  separator.value.setPointerCapture(event.pointerId);
  dragStart.value = {
    pointerId: event.pointerId,
    coordinate: props.orientation === 'horizontal' ? event.clientY : event.clientX,
    value: props.value,
  };
}

function onPointerMove(event: PointerEvent) {
  if (!dragStart.value || dragStart.value.pointerId !== event.pointerId) return;

  const coordinate = props.orientation === 'horizontal' ? event.clientY : event.clientX;
  const delta = coordinate - dragStart.value.coordinate;
  const direction = props.inverted ? -1 : 1;
  emit('change', clamp(dragStart.value.value + delta * direction));
}

function onPointerUp(event: PointerEvent) {
  if (!dragStart.value || dragStart.value.pointerId !== event.pointerId) return;
  if (separator.value?.hasPointerCapture(event.pointerId)) {
    separator.value.releasePointerCapture(event.pointerId);
  }
  dragStart.value = null;
}

function restoreDefault() {
  if (props.defaultValue == null) {
    emit('reset');
  } else {
    emit('change', clamp(props.defaultValue));
  }
}
</script>

<template>
  <div
    ref="separator"
    class="workspace-separator"
    :class="`is-${orientation}`"
    role="separator"
    :aria-label="label"
    :aria-controls="controls"
    :aria-orientation="orientation"
    :aria-valuemin="Math.round(min)"
    :aria-valuemax="Math.round(max)"
    :aria-valuenow="ariaValue"
    :aria-valuetext="`${ariaValue} px`"
    :title="`${label}. Стрілки змінюють розмір, подвійне натискання відновлює початковий.`"
    tabindex="0"
    @keydown="onKeydown"
    @dblclick="restoreDefault"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @lostpointercapture="dragStart = null"
  />
</template>

<style scoped>
.workspace-separator {
  position: relative;
  z-index: 1;
  flex: 0 0 auto;
  background: transparent;
  touch-action: none;
  cursor: row-resize;
}

.workspace-separator::after {
  position: absolute;
  content: '';
  border-radius: 999px;
  background: var(--color-border, #cbd5e1);
  transition: background-color 120ms ease;
}

.workspace-separator.is-horizontal {
  width: 100%;
  height: 8px;
}

.workspace-separator.is-horizontal::after {
  top: 3px;
  right: 0;
  left: 0;
  height: 2px;
}

.workspace-separator.is-vertical {
  width: 6px;
  cursor: col-resize;
}

.workspace-separator.is-vertical::after {
  top: 0;
  bottom: 0;
  left: 2px;
  width: 2px;
}

.workspace-separator:hover::after,
.workspace-separator:focus-visible::after {
  background: var(--color-primary);
}

.workspace-separator:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -1px;
}

@media (max-width: 720px) {
  .workspace-separator.is-horizontal {
    height: 12px;
  }

  .workspace-separator.is-horizontal::after {
    top: 5px;
  }
}
</style>
