<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import ModalDialog from '../../shared/ui/ModalDialog.vue';
import { ApiError } from '../../shared/api/client';
import { identitySession } from './identity-session';
import {
  createOAuthConnectionsApi,
  type OAuthConnection,
  type OAuthScope,
} from './oauth-connections-api';

const api = createOAuthConnectionsApi(identitySession.request);
const controller = new AbortController();
const enabled = ref(false);
const endpoint = ref('');
const checking = ref(true);
const availabilityError = ref('');
const loading = ref(false);
const error = ref('');
const connections = ref<OAuthConnection[]>([]);
const nextCursor = ref<number | null>(null);
const selected = ref<OAuthConnection | null>(null);
const revokeOpen = ref(false);
const revoking = ref(false);
const revokeError = ref('');
const copyMessage = ref('');
const copying = ref(false);
const endpointInput = ref<HTMLInputElement | null>(null);
const heading = ref<HTMLElement | null>(null);
const connectionRows = new Map<number, HTMLElement>();
const showSection = computed(() => enabled.value && !checking.value && !availabilityError.value);
const statusText: Record<OAuthConnection['status'], string> = {
  active: 'Підключено',
  expired: 'Термін дії завершився',
  revoked: 'Відкликано',
};
const scopeText: Record<OAuthScope, string> = {
  'projects:read': 'Перегляд проєктів',
  'documents:read': 'Перегляд документів і файлів',
  'context:read': 'Перегляд контексту проєкту',
  'history:read': 'Перегляд історії версій',
  'changes:read': 'Перегляд пропозицій змін',
  'changes:propose': 'Створення пропозицій змін',
  'uploads:stage': 'Завантаження ресурсів для пропозицій',
  'compile:run': 'Компіляція документів і перевірка пропозицій',
  'compile:read': 'Перегляд результатів компіляції',
};
const localDate = new Intl.DateTimeFormat('uk', { dateStyle: 'medium' });
const projectPlural = new Intl.PluralRules('uk');
function projectCount(count: number) {
  const forms = { one: 'проєкт', few: 'проєкти', many: 'проєктів', other: 'проєкту' };
  return `${count} ${forms[projectPlural.select(count) as keyof typeof forms]}`;
}
function missingProjectsText(count: number) {
  return `Недоступні проєкти (${count})`;
}

function setConnectionRow(id: number, element: unknown) {
  if (element instanceof HTMLElement) connectionRows.set(id, element);
  else connectionRows.delete(id);
}

async function loadConnections(cursor?: number, more = false) {
  if (loading.value) return;
  loading.value = true;
  error.value = '';
  try {
    const page = await api.list(cursor, controller.signal);
    if (controller.signal.aborted) return;
    connections.value = more
      ? [
          ...connections.value,
          ...page.items.filter((entry) => !connections.value.some(({ id }) => id === entry.id)),
        ]
      : page.items;
    nextCursor.value = page.nextCursor;
  } catch {
    if (!controller.signal.aborted)
      error.value = 'Не вдалося завантажити підключення. Перевірте з’єднання та спробуйте ще раз.';
  } finally {
    if (!controller.signal.aborted) loading.value = false;
  }
}

async function loadAvailability() {
  checking.value = true;
  availabilityError.value = '';
  try {
    const state = await api.availability(controller.signal);
    if (controller.signal.aborted) return;
    enabled.value = state.enabled;
    endpoint.value = state.url ?? '';
    if (state.enabled) await loadConnections();
  } catch {
    if (!controller.signal.aborted)
      availabilityError.value =
        'Не вдалося завантажити підключення застосунків. Перевірте з’єднання та спробуйте ще раз.';
  } finally {
    if (!controller.signal.aborted) checking.value = false;
  }
}

function openRevoke(connection: OAuthConnection) {
  if (connection.status !== 'active' || revoking.value || selected.value) return;
  selected.value = connection;
  revokeError.value = '';
  revokeOpen.value = true;
}
function closeRevoke() {
  if (!revoking.value) revokeOpen.value = false;
}
function closedRevoke() {
  const connection = selected.value;
  selected.value = null;
  revokeError.value = '';
  if (!connection || connections.value.find(({ id }) => id === connection.id)?.status === 'active')
    return;
  void nextTick(() => {
    const row = connectionRows.get(connection.id);
    (row ?? heading.value)?.focus({ preventScroll: true });
  });
}
async function revoke() {
  const connection = selected.value;
  if (!connection || revoking.value) return;
  revoking.value = true;
  revokeError.value = '';
  try {
    await api.revoke(connection.id, controller.signal);
    if (!controller.signal.aborted) {
      connections.value = connections.value.map((item) =>
        item.id === connection.id
          ? { ...item, status: 'revoked', revokedAt: new Date().toISOString() }
          : item,
      );
      revokeOpen.value = false;
    }
  } catch (cause) {
    if (!controller.signal.aborted)
      revokeError.value =
        cause instanceof ApiError && [403, 404].includes(cause.status)
          ? 'Це підключення вже недоступне. Оновіть список.'
          : 'Не вдалося відкликати доступ. Спробуйте ще раз.';
  } finally {
    if (!controller.signal.aborted) revoking.value = false;
  }
}
async function copyEndpoint() {
  if (copying.value || !endpoint.value) return;
  copying.value = true;
  copyMessage.value = '';
  try {
    await navigator.clipboard.writeText(endpoint.value);
    copyMessage.value = 'Адресу скопійовано.';
  } catch {
    await nextTick();
    endpointInput.value?.focus();
    endpointInput.value?.select();
    copyMessage.value = 'Адресу виділено. Скопіюйте її.';
  } finally {
    copying.value = false;
  }
}
function selectEndpoint(event: FocusEvent) {
  if (event.target instanceof HTMLInputElement) event.target.select();
}
onMounted(loadAvailability);
onBeforeUnmount(() => controller.abort());
</script>

<template>
  <section
    v-if="showSection || checking || availabilityError"
    class="oauth-connections"
    :aria-labelledby="showSection ? 'oauth-connections-title' : undefined"
    :aria-busy="checking || loading || revoking"
  >
    <div v-if="checking" class="panel oauth-state" role="status">Завантаження підключень…</div>
    <div v-else-if="availabilityError" class="panel oauth-state">
      <p class="field-error" role="alert">{{ availabilityError }}</p>
      <button class="button button-secondary" @click="loadAvailability">Повторити</button>
    </div>
    <div v-else-if="enabled" class="panel oauth-panel">
      <header class="oauth-heading">
        <div class="oauth-heading-title">
          <h2 id="oauth-connections-title" ref="heading" tabindex="-1">Підключення застосунків</h2>
          <button
            class="button button-quiet"
            :disabled="loading || revoking"
            @click="loadConnections()"
          >
            Оновити
          </button>
        </div>
        <div class="oauth-endpoint-field">
          <label for="oauth-endpoint">Адреса для підключення</label>
          <div class="oauth-endpoint">
            <input
              id="oauth-endpoint"
              ref="endpointInput"
              :value="endpoint"
              readonly
              @focus="selectEndpoint"
            />
            <button class="button button-quiet" :disabled="copying" @click="copyEndpoint">
              Скопіювати адресу
            </button>
          </div>
          <p class="field-hint oauth-setup-instructions">
            Вставте адресу в MCP-клієнт і завершіть підключення у браузері.
          </p>
          <p v-if="copyMessage" class="field-hint" role="status">{{ copyMessage }}</p>
        </div>
      </header>

      <div v-if="error" class="oauth-state">
        <p class="field-error" role="alert">{{ error }}</p>
        <button class="button button-secondary" :disabled="loading" @click="loadConnections()">
          Повторити
        </button>
      </div>
      <p v-else-if="loading && !connections.length" class="muted" role="status">
        Завантаження підключень…
      </p>
      <p v-else-if="!connections.length" class="muted">Підключених застосунків поки немає.</p>
      <ul v-else class="oauth-list">
        <li v-for="connection in connections" :key="connection.id">
          <article
            :ref="(element) => setConnectionRow(connection.id, element)"
            class="oauth-connection"
            :aria-label="connection.name"
            tabindex="-1"
          >
            <div class="oauth-connection-detail">
              <h3>{{ connection.name }}</h3>
              <p class="oauth-status">{{ statusText[connection.status] }}</p>
              <p class="muted">
                {{ projectCount(connection.projectIds.length) }}
                <template v-if="connection.status === 'active'">
                  · до {{ localDate.format(new Date(connection.expiresAt)) }}
                </template>
              </p>
              <details>
                <summary>Переглянути дозволи</summary>
                <h4>Проєкти</h4>
                <ul class="oauth-scopes">
                  <li v-for="project in connection.projects" :key="project.id">
                    {{ project.title }}
                  </li>
                  <li
                    v-if="connection.projects.length < connection.projectIds.length"
                    class="muted"
                  >
                    {{
                      missingProjectsText(connection.projectIds.length - connection.projects.length)
                    }}
                  </li>
                </ul>
                <h4>Дозволи</h4>
                <ul class="oauth-scopes">
                  <li v-for="scope in connection.scopes" :key="scope">{{ scopeText[scope] }}</li>
                </ul>
              </details>
            </div>
            <button
              v-if="connection.status === 'active'"
              class="button button-secondary danger-text"
              :aria-label="'Відкликати доступ · ' + connection.name"
              :disabled="revoking || loading"
              @click="openRevoke(connection)"
            >
              Відкликати доступ
            </button>
          </article>
        </li>
      </ul>
      <button
        v-if="nextCursor !== null"
        class="button button-quiet oauth-more"
        :disabled="loading"
        @click="loadConnections(nextCursor, true)"
      >
        {{ loading ? 'Завантаження…' : 'Показати ще' }}
      </button>
    </div>

    <ModalDialog
      :open="revokeOpen"
      title="Відкликати доступ до застосунку?"
      :busy="revoking"
      @dismiss="closeRevoke"
      @closed="closedRevoke"
    >
      <p>
        Застосунок «{{ selected?.name }}» втратить доступ до вибраних проєктів. Його можна
        підключити знову.
      </p>
      <p v-if="revokeError" class="field-error" role="alert">{{ revokeError }}</p>
      <div class="modal-actions">
        <button class="button button-secondary" :disabled="revoking" @click="closeRevoke">
          Скасувати
        </button>
        <button class="button button-danger" :disabled="revoking" @click="revoke">
          {{ revoking ? 'Відкликання…' : 'Відкликати доступ' }}
        </button>
      </div>
    </ModalDialog>
  </section>
</template>

<style scoped>
.oauth-connections {
  margin-top: 18px;
}
.oauth-panel {
  padding: 18px 20px;
}
.oauth-heading {
  display: grid;
  gap: 12px;
  margin-bottom: 14px;
}
.oauth-heading-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.oauth-heading-title h2 {
  margin: 0;
}
.oauth-endpoint-field label {
  display: block;
  margin-bottom: 4px;
  color: var(--color-muted);
  font-size: 12px;
}
.oauth-endpoint {
  display: flex;
  align-items: center;
  gap: 8px;
}
.oauth-endpoint input {
  min-width: 0;
  flex: 1;
  min-height: 40px;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-background);
  color: var(--color-text);
  font: 12px var(--font-code);
}
.oauth-endpoint-field .field-hint {
  margin: 4px 0 0;
}
.oauth-setup-instructions {
  color: var(--color-muted);
}
.oauth-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.oauth-connection {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 0;
  border-top: 1px solid var(--color-border);
}
.oauth-connection-detail {
  min-width: 0;
}
.oauth-connection h3 {
  margin: 0 0 2px;
  overflow-wrap: anywhere;
  font-size: 14px;
}
.oauth-connection p {
  margin: 0;
  font-size: 12px;
}
.oauth-status {
  color: var(--color-primary);
}
.oauth-connection details {
  margin-top: 4px;
  color: var(--color-muted);
  font-size: 12px;
}
.oauth-connection summary {
  cursor: pointer;
}
.oauth-scopes {
  margin: 6px 0 0;
  padding-left: 18px;
}
.oauth-more {
  margin-top: 8px;
}
.oauth-state {
  padding: 16px 20px;
  color: var(--color-muted);
}
.oauth-state p {
  margin: 0;
}
.oauth-state button {
  margin-top: 8px;
}
@media (max-width: 640px) {
  .oauth-panel {
    padding: 16px;
  }
  .oauth-endpoint,
  .oauth-connection {
    align-items: stretch;
    flex-direction: column;
  }
  .oauth-connection {
    align-items: flex-start;
  }
}
</style>
