<script setup lang="ts">
import { useWorkspaceUiStore } from './workspace-ui.store';

const ui = useWorkspaceUiStore();
const source = `#set document(title: "Архітектура системи")
#set text(lang: "uk")

= Архітектура системи

Typstoria — середовище для підготовки
технічної документації.

== Основні компоненти

- Вебінтерфейс для роботи з документом
- API для зберігання та компіляції
- MCP для зовнішнього ШІ-асистента`;
</script>

<template>
  <section class="page workspace-page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">Макет робочого простору</p>
        <h1>Архітектура системи</h1>
        <p class="muted">Зразок компонування · текст доступний лише для читання</p>
      </div>
      <div class="toolbar">
        <button class="button button-secondary" disabled>Зберегти</button>
        <button class="button button-primary" disabled>Скомпілювати</button>
      </div>
    </div>
    <div class="workspace-controls">
      <button
        class="button button-quiet"
        :aria-expanded="ui.filesVisible"
        aria-controls="file-tree"
        @click="ui.filesVisible = !ui.filesVisible"
      >
        Файли {{ ui.filesVisible ? '−' : '+' }}
      </button>
      <div class="pane-switch" aria-label="Видима панель на вузькому екрані">
        <button :aria-pressed="ui.activePane === 'source'" @click="ui.activePane = 'source'">
          Вихідний текст
        </button>
        <button :aria-pressed="ui.activePane === 'preview'" @click="ui.activePane = 'preview'">
          Перегляд PDF
        </button>
      </div>
      <span class="status-badge">Демонстраційний документ</span>
    </div>
    <div class="workspace-layout" :class="{ 'without-files': !ui.filesVisible }">
      <aside v-if="ui.filesVisible" id="file-tree" class="panel file-tree" aria-label="Файли">
        <h2 class="panel-title">Файли проєкту</h2>
        <p class="file-item active-file"><span aria-hidden="true">◇</span> main.typ</p>
        <p class="tree-hint muted">Ресурси документа будуть тут. Контекст і матеріали — окремо.</p>
      </aside>
      <section class="panel source-pane" :class="{ 'pane-hidden': ui.activePane !== 'source' }">
        <h2 class="panel-title">main.typ <span class="muted">/ Typst</span></h2>
        <pre
          class="source-code"
          tabindex="0"
          aria-label="Приклад вихідного тексту"
        ><code>{{ source }}</code></pre>
      </section>
      <section class="panel preview-pane" :class="{ 'pane-hidden': ui.activePane !== 'preview' }">
        <h2 class="panel-title">Перегляд <span class="muted">/ зразок, не PDF</span></h2>
        <div class="paper-surround">
          <article class="paper">
            <span class="paper-caption">ТЕХНІЧНА ДОКУМЕНТАЦІЯ</span>
            <h3>Архітектура системи</h3>
            <p>Typstoria — середовище для підготовки технічної документації.</p>
            <h4>Основні компоненти</h4>
            <ul>
              <li>Вебінтерфейс для роботи з документом</li>
              <li>API для зберігання та компіляції</li>
              <li>MCP для зовнішнього ШІ-асистента</li>
            </ul>
          </article>
        </div>
      </section>
    </div>
    <p class="caption muted">Майбутні стани збереження та компіляції відображатимуться окремо.</p>
  </section>
</template>
