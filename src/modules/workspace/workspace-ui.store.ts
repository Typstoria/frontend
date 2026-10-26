import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useWorkspaceUiStore = defineStore('workspace-ui', () => {
  const activePane = ref<'source' | 'preview'>('source');
  const filesVisible = ref(true);
  return { activePane, filesVisible };
});
