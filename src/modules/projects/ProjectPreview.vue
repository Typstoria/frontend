<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

const props = defineProps<{
  projectId: number;
  version: string | null;
  load: (projectId: number, version: string, signal: AbortSignal) => Promise<Blob>;
}>();

const host = ref<HTMLElement | null>(null);
const imageUrl = ref<string | null>(null);
const controller = new AbortController();
let observer: IntersectionObserver | null = null;
let started = false;

async function performLoad() {
  if (started || !props.version) return;
  started = true;
  try {
    const blob = await props.load(props.projectId, props.version, controller.signal);
    if (controller.signal.aborted) return;
    imageUrl.value = URL.createObjectURL(blob);
  } catch {
    // Missing or stale previews deliberately leave a clean white page.
  }
}

onMounted(() => {
  if (!props.version) return;
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
  <div ref="host" class="project-preview" aria-hidden="true">
    <img v-if="imageUrl" :src="imageUrl" alt="" />
  </div>
</template>
