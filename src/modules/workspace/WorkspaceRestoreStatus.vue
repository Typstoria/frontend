<script setup lang="ts">
defineProps<{
  error: string;
  notice: string;
  restoring: boolean;
  retryLabel: string | undefined;
  retryDisabled: boolean;
}>();
const emit = defineEmits<{ retry: [] }>();
</script>

<template>
  <div v-if="error || restoring" class="editor-notice" :role="error ? 'alert' : 'status'">
    <p>{{ restoring ? 'Відновлення версії…' : error }}</p>
    <button
      v-if="retryLabel && !restoring"
      type="button"
      class="button button-secondary"
      :disabled="retryDisabled"
      @click="emit('retry')"
    >
      {{ retryLabel }}
    </button>
  </div>
  <p v-else-if="notice" class="workspace-restore-notice" role="status">{{ notice }}</p>
</template>
