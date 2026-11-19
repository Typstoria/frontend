<script setup lang="ts">
defineProps<{
  id: string;
  label: string;
  directories: readonly string[];
  modelValue: string;
  disabled?: boolean;
}>();
defineEmits<{ 'update:modelValue': [value: string] }>();
</script>

<template>
  <div class="form-field">
    <label :for="id">{{ label }}</label>
    <select
      :id="id"
      :value="modelValue"
      :disabled="disabled"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option value="">Корінь проєкту</option>
      <option v-for="directory in directories" :key="directory" :value="directory">
        {{ directory }}
      </option>
    </select>
  </div>
</template>

<style scoped>
select {
  width: 100%;
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
}
</style>
