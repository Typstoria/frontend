<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

const props = defineProps<{
  load?: ((signal: AbortSignal) => Promise<Blob>) | undefined;
  unavailableLabel?: string;
}>();

const host = ref<HTMLElement | null>(null);
const imageUrl = ref<string | null>(null);
const failed = ref(false);
const controller = new AbortController();
let observer: IntersectionObserver | null = null;
let started = false;

async function performLoad() {
  if (started || !props.load) return;
  started = true;
  try {
    const blob = await props.load(controller.signal);
    if (controller.signal.aborted) return;
    imageUrl.value = URL.createObjectURL(blob);
  } catch {
    if (!controller.signal.aborted) failed.value = true;
  }
}

onMounted(() => {
  if (!props.load) return;
  if (!('IntersectionObserver' in window)) {
    void performLoad();
    return;
  }
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer?.disconnect();
        void performLoad();
      }
    },
    { rootMargin: '160px' },
  );
  if (host.value) observer.observe(host.value);
});

onBeforeUnmount(() => {
  observer?.disconnect();
  controller.abort();
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value);
});
</script>

<template>
  <div ref="host" :aria-hidden="!unavailableLabel">
    <img v-if="imageUrl" :src="imageUrl" alt="" />
    <p v-else-if="failed && unavailableLabel" class="muted" role="status">{{ unavailableLabel }}</p>
  </div>
</template>
