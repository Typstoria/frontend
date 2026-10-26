<script setup lang="ts">
import { RouterLink } from 'vue-router';
</script>

<template>
  <section class="page narrow-page">
    <p class="eyebrow">404</p>
    <h1>Сторінку не знайдено</h1>
    <p class="muted">Перевірте адресу або поверніться до своїх документів.</p>
    <RouterLink to="/projects" class="button button-primary">До проєктів</RouterLink>
  </section>
</template>
