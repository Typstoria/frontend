<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { renderGoogleButton } from './google-identity';

const props = defineProps<{ disabled?: boolean }>();
const emit = defineEmits<{ credential: [value: string] }>();
const target = ref<HTMLElement>();
const unavailable = ref(false);
const loading = ref(false);
const clientId = String(import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim();
let alive = true;
let dispose: (() => void) | undefined;

async function render() {
  if (!clientId || !target.value) return;
  loading.value = true;
  unavailable.value = false;
  try {
    const cleanup = await renderGoogleButton(
      target.value,
      clientId,
      (value) => {
        if (alive && !props.disabled) emit('credential', value);
      },
      () => alive,
    );
    if (alive) dispose = cleanup;
    else cleanup();
  } catch {
    if (alive) unavailable.value = true;
  } finally {
    if (alive) loading.value = false;
  }
}
onMounted(render);
onBeforeUnmount(() => {
  alive = false;
  dispose?.();
});
</script>

<template>
  <div
    v-if="clientId"
    class="google-control"
    :class="{ 'is-disabled': disabled }"
    :aria-busy="loading"
  >
    <div ref="target" class="google-target" :inert="disabled || undefined"></div>
    <p v-if="loading" class="caption muted" role="status">Завантажуємо Google…</p>
    <div v-if="unavailable" class="google-unavailable" role="status">
      <p>Не вдалося завантажити Google. Можна увійти з паролем.</p>
      <button type="button" class="text-button" @click="render">Спробувати знову</button>
    </div>
  </div>
</template>
