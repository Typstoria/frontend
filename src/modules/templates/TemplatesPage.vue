<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import DocumentCover from '../../shared/ui/DocumentCover.vue';
import LoadError from '../../shared/ui/LoadError.vue';
import { createTemplateCovers } from './template-covers';
import TemplateDetail from './TemplateDetail.vue';
import { SHARED_TEMPLATE_PATH, shareToken } from './share-navigation';
import {
  createTemplatesApi,
  transferError,
  type OwnedTemplate,
  type SystemTemplate,
} from './templates-api';
import './transfer.css';
import './templates.css';

const route = useRoute();
const api = createTemplatesApi();
const covers = createTemplateCovers();
const systems = ref<SystemTemplate[] | null>(null);
const owned = ref<OwnedTemplate[] | null>(null);
const cursor = ref<number | null>(null);
const loading = ref(false);
const loadError = ref('');
const failedMore = ref(false);
const deleted = ref(false);
let request: AbortController | undefined;
onBeforeUnmount(() => {
  request?.abort();
  covers.dispose();
});

const shared = computed(() => route.path === SHARED_TEMPLATE_PATH);
const token = computed(() => (shared.value ? shareToken(route.hash) : null));
const tab = computed(() => (route.query.tab === 'owned' ? 'owned' : 'system'));
const source = computed(() => {
  if (shared.value) return token.value ? { kind: 'shared' as const, token: token.value } : null;
  const { system, owned } = route.query;
  if (typeof system === 'string' && /^[a-z0-9-]+$/.test(system))
    return { kind: 'system' as const, key: system };
  if (typeof owned === 'string' && /^[1-9][0-9]{0,9}$/.test(owned) && Number(owned) <= 2147483647)
    return { kind: 'owned' as const, id: Number(owned) };
  return null;
});
const detailKey = computed(() => {
  const item = source.value;
  if (!item) return '';
  if (item.kind === 'shared') return route.hash;
  return item.kind === 'system' ? item.key : item.id;
});
const mode = computed(() => (shared.value || source.value ? 'detail' : tab.value));
const templateDate = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'medium' });

watch(
  mode,
  () => {
    request?.abort();
    loading.value = false;
    loadError.value = '';
    deleted.value = false;
    if (mode.value === 'detail') return;
    if (mode.value === 'owned' && window.history.state?.templateDeleted) {
      deleted.value = true;
      window.history.replaceState({ ...window.history.state, templateDeleted: false }, '');
    }
    void load();
  },
  { immediate: true },
);

async function load(more = false) {
  if (loading.value || mode.value === 'detail' || (more && !cursor.value)) return;
  const controller = new AbortController();
  request = controller;
  loading.value = true;
  loadError.value = '';
  failedMore.value = more;
  try {
    if (mode.value === 'system') {
      systems.value = await api.systems(controller.signal);
    } else {
      const page = await api.owned(
        controller.signal,
        more ? (cursor.value ?? undefined) : undefined,
      );
      controller.signal.throwIfAborted();
      owned.value = more ? [...(owned.value ?? []), ...page.items] : page.items;
      cursor.value = page.nextCursor;
    }
  } catch (cause) {
    if (!controller.signal.aborted)
      loadError.value = transferError(cause, 'Перевірте з’єднання й повторіть спробу.');
  } finally {
    if (request === controller) loading.value = false;
  }
}
</script>

<template>
  <section class="page templates-page">
    <TemplateDetail v-if="source" :key="detailKey" :source="source" :load-cover="covers.load" />
    <div v-else-if="shared" class="panel template-state">
      <h1>Шаблон недоступний</h1>
      <p class="muted">Відкрийте повне посилання від автора шаблону.</p>
    </div>
    <template v-else>
      <header class="templates-header">
        <h1>Шаблони</h1>
      </header>
      <nav class="template-tabs" aria-label="Категорії шаблонів">
        <RouterLink
          to="/templates"
          :aria-current="tab === 'system' ? 'page' : undefined"
          active-class=""
          exact-active-class=""
          >Системні</RouterLink
        >
        <RouterLink
          :to="{ path: '/templates', query: { tab: 'owned' } }"
          :aria-current="tab === 'owned' ? 'page' : undefined"
          active-class=""
          exact-active-class=""
          >Мої шаблони</RouterLink
        >
      </nav>
      <p v-if="deleted" class="projects-notice" role="status">Шаблон видалено.</p>
      <p v-if="loading" class="muted template-catalog-status" role="status">
        Завантажуємо шаблони…
      </p>
      <LoadError
        v-if="loadError"
        title="Не вдалося завантажити шаблони"
        :message="loadError"
        retry-label="Повторити"
        @retry="load(failedMore)"
      />
      <ul
        v-if="tab === 'system' && systems?.length"
        class="template-cards"
        aria-label="Системні шаблони"
      >
        <li v-for="item in systems" :key="item.key">
          <RouterLink
            class="panel template-card"
            :to="{ path: '/templates', query: { system: item.key } }"
          >
            <DocumentCover
              class="template-cover"
              :load="(signal) => covers.load({ kind: 'system', key: item.key }, signal)"
            />
            <div class="template-card-caption">
              <div class="template-card-text">
                <h2>{{ item.title }}</h2>
                <p v-if="item.description">{{ item.description }}</p>
              </div>
              <span class="template-card-arrow" aria-hidden="true">→</span>
            </div>
          </RouterLink>
        </li>
      </ul>
      <ul
        v-else-if="tab === 'owned' && owned?.length"
        class="template-cards"
        aria-label="Мої шаблони"
      >
        <li v-for="item in owned" :key="item.id">
          <RouterLink
            class="panel template-card"
            :to="{ path: '/templates', query: { owned: item.id } }"
          >
            <DocumentCover
              class="template-cover"
              :load="(signal) => covers.load({ kind: 'owned', id: item.id }, signal)"
            />
            <div class="template-card-caption">
              <div class="template-card-text">
                <h2>{{ item.title }}</h2>
                <p v-if="item.description" class="template-card-description">
                  {{ item.description }}
                </p>
                <small
                  >Створено
                  <time :datetime="item.createdAt">{{
                    templateDate.format(new Date(item.createdAt))
                  }}</time></small
                >
              </div>
              <span class="template-card-arrow" aria-hidden="true">→</span>
            </div>
          </RouterLink>
        </li>
      </ul>
      <div v-else-if="!loading && !loadError" class="panel template-state">
        <h2>
          {{ tab === 'owned' ? 'Власних шаблонів ще немає' : 'Системних шаблонів поки немає' }}
        </h2>
        <p v-if="tab === 'owned'" class="muted">
          У редакторі виберіть «Проєкт → Зберегти як шаблон».
        </p>
      </div>
      <button
        v-if="tab === 'owned' && cursor && !loadError"
        class="button button-secondary template-more"
        :disabled="loading"
        @click="load(true)"
      >
        Завантажити ще
      </button>
    </template>
  </section>
</template>
