<script setup lang="ts">
import { onBeforeUnmount, useId } from 'vue';

const props = defineProps<{ open: boolean; title: string; busy?: boolean }>();
const emit = defineEmits<{ dismiss: []; closed: [] }>();
const titleId = useId();
let dialog: HTMLDialogElement | null = null;
let previousFocus: HTMLElement | null = null;

function enter(element: Element) {
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  dialog = element as HTMLDialogElement;
  dialog.showModal();
}
function close() {
  dialog?.close();
  dialog = null;
  if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
}
function afterLeave() {
  close();
  emit('closed');
}
onBeforeUnmount(close);
function cancel(event: Event) {
  event.preventDefault();
  if (!props.busy) emit('dismiss');
}
function trapFocus(event: KeyboardEvent) {
  const controls = Array.from(
    dialog?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), a[href], select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ) ?? [],
  ).filter((element) => element.getClientRects().length > 0);
  const target = event.shiftKey ? controls.at(-1) : controls[0];
  const boundary = event.shiftKey ? controls[0] : controls.at(-1);
  if (!controls.length || document.activeElement === boundary) {
    event.preventDefault();
    target?.focus();
  }
}
</script>

<template>
  <Transition name="modal" @enter="enter" @after-leave="afterLeave">
    <dialog
      v-if="open"
      class="modal-dialog"
      :aria-labelledby="titleId"
      :aria-busy="busy"
      @cancel="cancel"
      @keydown.tab="trapFocus"
    >
      <h2 :id="titleId">{{ title }}</h2>
      <slot />
    </dialog>
  </Transition>
</template>

<style>
.modal-enter-active,
.modal-leave-active {
  transition:
    opacity 160ms ease,
    transform 160ms ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.985);
}
.modal-enter-active::backdrop {
  animation: modal-backdrop 160ms ease both;
}
.modal-leave-active::backdrop {
  animation: modal-backdrop 160ms ease reverse both;
}
@keyframes modal-backdrop {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .modal-enter-active,
  .modal-leave-active {
    transition: none;
  }
  .modal-enter-active::backdrop,
  .modal-leave-active::backdrop {
    animation: none;
  }
}
</style>
