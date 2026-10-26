<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
</script>

<template>
  <a class="skip-link" href="#main-content">Перейти до вмісту</a>
  <div class="app-shell">
    <header class="app-header">
      <RouterLink to="/projects" class="brand" aria-label="Typstoria — проєкти">
        <span class="brand-mark" aria-hidden="true">T.</span>
        Typstoria
      </RouterLink>
      <nav class="main-nav" aria-label="Головна навігація">
        <RouterLink to="/projects">Проєкти</RouterLink>
        <RouterLink to="/preview/workspace">Редактор</RouterLink>
        <RouterLink to="/preview/review">ШІ-пропозиції</RouterLink>
      </nav>
      <RouterLink class="button button-secondary" to="/auth/login">Увійти</RouterLink>
    </header>
    <div class="prototype-notice">Каркас інтерфейсу · демонстраційні дані · API не підключено</div>
    <main id="main-content" tabindex="-1">
      <RouterView />
    </main>
    <footer class="app-footer">
      Typst-документи. Зовнішній ШІ. Ваше рішення щодо кожної зміни.
    </footer>
  </div>
</template>
