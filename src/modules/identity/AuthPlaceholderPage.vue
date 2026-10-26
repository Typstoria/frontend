<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';

const route = useRoute();
const titles: Record<string, string> = {
  login: 'Вхід до Typstoria',
  register: 'Створення облікового запису',
  'verify-email': 'Підтвердження пошти',
  'forgot-password': 'Відновлення доступу',
  'reset-password': 'Новий пароль',
};
const title = computed(() => titles[String(route.params.flow)] ?? 'Обліковий запис');
</script>

<template>
  <section class="page narrow-page">
    <p class="eyebrow">Обліковий запис</p>
    <h1>{{ title }}</h1>
    <div class="panel auth-placeholder">
      <h2>Сторінку підготовлено для наступного етапу</h2>
      <p class="muted">
        Авторизація ще не підключена до цього каркаса. Ця сторінка не приймає паролів і не виконує
        запитів.
      </p>
      <RouterLink to="/projects" class="button button-secondary">До проєктів</RouterLink>
    </div>
  </section>
</template>
