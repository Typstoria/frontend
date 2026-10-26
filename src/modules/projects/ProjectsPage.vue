<script setup lang="ts">
import { RouterLink } from 'vue-router';
</script>

<template>
  <section class="page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">Робочий простір</p>
        <h1>Ваші проєкти</h1>
        <p class="muted">Технічна документація від першого рядка до готового PDF.</p>
      </div>
      <button class="button button-primary" disabled aria-describedby="projects-availability">
        + Новий проєкт
      </button>
    </div>
    <div class="empty-state panel">
      <span class="empty-mark" aria-hidden="true">[ T ]</span>
      <h2>Місце для ваших документів</h2>
      <p id="projects-availability" class="muted">
        Створення та список проєктів з’являться після підключення API проєктів.
      </p>
      <RouterLink to="/preview/workspace" class="button button-secondary">
        Переглянути макет редактора <span aria-hidden="true">↗</span>
      </RouterLink>
    </div>
    <div class="feature-grid">
      <article class="panel feature-card">
        <p class="eyebrow">01 / Написання</p>
        <h2>Текст і результат поруч</h2>
        <p class="muted">Дерево файлів, Typst-редактор і PDF в одному робочому просторі.</p>
      </article>
      <article class="panel feature-card">
        <p class="eyebrow">02 / Контроль</p>
        <h2>Правки з вашим підтвердженням</h2>
        <p class="muted">Зовнішній ШІ готує пропозицію. Ви переглядаєте зміни й вирішуєте.</p>
      </article>
      <article class="panel feature-card">
        <p class="eyebrow">03 / Історія</p>
        <h2>Збережені версії</h2>
        <p class="muted">Порівняння та відновлення попереднього стану документа.</p>
      </article>
    </div>
  </section>
</template>
