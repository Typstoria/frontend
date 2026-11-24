<script setup lang="ts">
import type { Material, MaterialDiff } from './material-metadata';

defineProps<{ changes: MaterialDiff[]; downloads?: boolean; downloading?: boolean }>();
const emit = defineEmits<{ download: [material: Material, side: 'before' | 'after'] }>();

const labels: Record<MaterialDiff['change'], string> = {
  added: 'Додано',
  deleted: 'Видалено',
  replaced: 'Замінено',
  renamed: 'Перейменовано',
};
</script>

<template>
  <section v-if="changes.length" aria-label="Зміни матеріалів" class="material-changes">
    <h3>Матеріали</h3>
    <ul>
      <li v-for="{ materialId, change, before, after } in changes" :key="materialId">
        <div>
          <strong>{{ before?.name ?? after?.name }}</strong>
          <strong v-if="before && after && before.name !== after.name"> → {{ after.name }}</strong>
          <span> · {{ labels[change] }}</span>
        </div>
        <div v-if="downloads" class="material-downloads">
          <button
            v-if="before"
            type="button"
            class="button button-quiet"
            :disabled="downloading"
            :aria-label="`Завантажити попередній матеріал ${before.name}`"
            @click="emit('download', before, 'before')"
          >
            {{ after ? 'Попередній файл' : 'Завантажити файл' }}
          </button>
          <button
            v-if="after && change !== 'renamed'"
            type="button"
            class="button button-quiet"
            :disabled="downloading"
            :aria-label="`Завантажити запропонований матеріал ${after.name}`"
            @click="emit('download', after, 'after')"
          >
            {{ before ? 'Новий файл' : 'Завантажити файл' }}
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.material-changes {
  min-width: 0;
  padding: 10px 12px;
}
.material-changes h3 {
  margin: 0 0 6px;
  font-size: 13px;
}
.material-changes ul {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 13px;
  overflow-wrap: anywhere;
}
.material-changes li span {
  color: var(--color-muted);
}
.material-downloads {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
}
</style>
