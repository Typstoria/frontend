<script setup lang="ts">
import { ref } from 'vue';

defineProps<{
  id: string;
  autocomplete: string;
  minLength: number;
  describedby?: string;
  invalid?: boolean;
}>();
const model = defineModel<string>({ required: true });
const visible = ref(false);
</script>

<template>
  <div class="password-control">
    <input
      :id="id"
      v-model="model"
      :type="visible ? 'text' : 'password'"
      :autocomplete="autocomplete"
      :minlength="minLength"
      maxlength="128"
      required
      :aria-describedby="describedby"
      :aria-invalid="invalid || undefined"
    />
    <button
      type="button"
      class="password-toggle"
      :aria-label="visible ? 'Приховати пароль' : 'Показати пароль'"
      :aria-pressed="visible"
      @click="visible = !visible"
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"
          stroke="currentColor"
          stroke-width="1.6"
        />
        <circle cx="12" cy="12" r="2.5" stroke="currentColor" stroke-width="1.6" />
        <path v-if="visible" d="m4 3 16 18" stroke="currentColor" stroke-width="1.6" />
      </svg>
    </button>
  </div>
</template>
