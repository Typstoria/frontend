<script setup lang="ts">
const before = '= Архітектура системи\n\n== Основні компоненти';
const after =
  '= Архітектура системи\n\nКожен проєкт зберігає незалежну історію версій.\n\n== Основні компоненти';
</script>

<template>
  <section class="page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">Макет перегляду пропозиції</p>
        <h1>Уточнення опису архітектури</h1>
        <p class="muted">Приклад від зовнішнього ШІ · основний документ ще не змінено</p>
      </div>
      <span class="status-badge">Приклад · без перевірки</span>
    </div>
    <div class="review-layout">
      <section class="panel">
        <h2 class="panel-title">main.typ · приклад порівняння</h2>
        <div class="diff-grid">
          <div>
            <h3 class="diff-heading">Поточна версія</h3>
            <pre class="source-code"><code>{{ before }}</code></pre>
          </div>
          <div class="diff-addition">
            <h3 class="diff-heading">Пропозиція</h3>
            <pre class="source-code"><code>{{ after }}</code></pre>
          </div>
        </div>
      </section>
      <aside class="panel review-summary">
        <p class="eyebrow">Рішення за вами</p>
        <h2>Перевірте зміни</h2>
        <p class="muted">
          У робочій версії тут будуть результат перевірки, PDF та перелік усіх змін.
        </p>
        <button class="button button-primary" disabled>Прийняти пропозицію</button>
        <button class="button button-secondary" disabled>Відхилити</button>
        <p class="caption muted">Дії доступні після підключення API та перевірки пропозиції.</p>
      </aside>
    </div>
  </section>
</template>
