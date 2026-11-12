import { computed, reactive } from 'vue';
import { ApiError } from '../../shared/api/client';
import type { Changes, Snapshot, WorkspaceApi } from './workspace-api';

type Draft = { base: string; content: string };
type Attempt = { body: Changes; key: string };
type SaveStatus = 'clean' | 'dirty' | 'saving' | 'failed' | 'outcome_unknown' | 'conflict';
export type Recovery = {
  snapshot: Snapshot;
  files: Record<number, Draft>;
  pending: Attempt | null;
  status: SaveStatus;
  conflict: { snapshot: Snapshot; files: ConflictFile[] } | null;
};
export type ConflictFile = {
  fileId: number;
  path: string;
  base: string;
  local: string;
  remote: string | null;
  merged: string;
  useRemote: boolean;
};

export function workspaceError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 404) return 'Проєкт або файл недоступний.';
    if (error.status === 401) return 'Сеанс завершився. Увійдіть знову, щоб продовжити.';
    if (error.status === 403) return 'Немає доступу до цього проєкту.';
    if (error.status === 413) return 'Зміни завеликі. Зменште обсяг тексту.';
    if (error.status === 429) return 'Забагато запитів. Спробуйте трохи пізніше.';
  }
  return fallback;
}

export function createWorkspaceModel(projectId: number, api: WorkspaceApi, delay = 1000) {
  const state = reactive({
    snapshot: null as Snapshot | null,
    files: {} as Record<number, Draft>,
    selectedId: 0,
    loading: false,
    fileLoading: false,
    error: '',
    fileError: '',
    saveError: '',
    status: 'clean' as SaveStatus,
    pending: null as Attempt | null,
    conflict: null as { snapshot: Snapshot; files: ConflictFile[] } | null,
    conflictLoading: false,
    conflictError: '',
    resetKey: 0,
  });
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active = true;
  let composing = false;
  let fileSequence = 0;
  const dirty = computed(() => Object.values(state.files).some((f) => f.base !== f.content));
  const atRisk = computed(() => dirty.value || state.pending !== null);
  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
  };
  function schedule() {
    clearTimer();
    if (!active || composing || state.status !== 'dirty') return;
    timer = setTimeout(() => {
      void save();
    }, delay);
  }
  async function select(fileId: number) {
    state.selectedId = fileId;
    state.fileError = '';
    const sequence = ++fileSequence;
    state.fileLoading = false;
    const file = state.snapshot?.tree.find((f) => f.fileId === fileId);
    if (!file || file.contentKind !== 'text' || state.files[fileId]) return;
    state.fileLoading = true;
    try {
      const revision = state.snapshot!.revision.id;
      const text = await api.text(projectId, fileId, revision, controller.signal);
      if (!active || sequence !== fileSequence) return;
      // A save may have moved the base while this file was loading.
      if (state.snapshot!.revision.id !== revision) {
        await select(fileId);
        return;
      }
      state.files[fileId] = { base: text.content, content: text.content };
    } catch (error) {
      if (active && sequence === fileSequence)
        state.fileError = workspaceError(error, 'Не вдалося завантажити файл. Спробуйте ще раз.');
    } finally {
      if (active && sequence === fileSequence) state.fileLoading = false;
    }
  }
  async function load(recovery?: Recovery) {
    state.loading = true;
    state.error = '';
    try {
      if (recovery) {
        state.snapshot = recovery.snapshot;
        state.files = recovery.files;
        state.pending = recovery.pending;
        state.conflict = recovery.conflict;
        state.status = recovery.pending
          ? 'outcome_unknown'
          : recovery.status === 'conflict'
            ? 'conflict'
            : dirty.value
              ? 'dirty'
              : 'clean';
        if (state.pending)
          state.saveError =
            'Результат попереднього збереження невідомий. Повторіть його перед наступними змінами.';
        else if (state.status === 'conflict')
          state.saveError =
            'Проєкт змінився в іншій вкладці. Порівняйте тексти перед продовженням.';
      } else {
        const snapshot = await api.state(projectId, controller.signal);
        if (!active) return;
        state.snapshot = snapshot;
      }
      if (!active) return;
      await select(state.snapshot!.mainFileId);
      schedule();
    } catch (error) {
      if (active)
        state.error = workspaceError(error, 'Не вдалося відкрити проєкт. Спробуйте ще раз.');
    } finally {
      if (active) state.loading = false;
    }
  }
  function edit(fileId: number, content: string) {
    const file = state.files[fileId];
    if (!file || state.conflict || state.conflictLoading) return;
    file.content = content;
    if (['clean', 'dirty', 'failed'].includes(state.status)) {
      state.status = dirty.value ? 'dirty' : 'clean';
      state.saveError = '';
    }
    schedule();
  }
  function composition(value: boolean) {
    composing = value;
    if (value) clearTimer();
    else schedule();
  }
  async function save() {
    clearTimer();
    if (!active || composing || !state.snapshot || ['saving', 'conflict'].includes(state.status))
      return;
    if (!state.pending) {
      const operations = Object.entries(state.files)
        .filter(([, f]) => f.base !== f.content)
        .map(([fileId, f]) => ({
          type: 'updateText' as const,
          fileId: Number(fileId),
          content: f.content,
        }));
      if (!operations.length) {
        state.status = 'clean';
        return;
      }
      const body: Changes = { baseRevisionId: state.snapshot.revision.id, operations };
      const bytes = new TextEncoder();
      if (
        operations.length > 200 ||
        operations.some((o) => bytes.encode(o.content).length > 1048576) ||
        bytes.encode(JSON.stringify(body)).length > 8 * 1048576
      ) {
        state.status = 'failed';
        state.saveError =
          'Зміни завеликі: до 1 МіБ тексту на файл, 200 файлів і 8 МіБ на збереження. Зменште обсяг або завантажте копію.';
        return;
      }
      state.pending = { body, key: crypto.randomUUID() };
    }
    const attempt = state.pending;
    state.status = 'saving';
    state.saveError = '';
    try {
      const result = await api.save(projectId, attempt.body, attempt.key, controller.signal);
      if (!active) return;
      for (const change of attempt.body.operations)
        state.files[change.fileId]!.base = change.content;
      state.snapshot.revision.id = result.revisionId;
      state.snapshot.revision.number = result.revisionNumber;
      state.snapshot.revision.manifestHash = result.manifestHash;
      state.snapshot.project.currentRevisionId = result.revisionId;
      state.pending = null;
      state.status = dirty.value ? 'dirty' : 'clean';
      schedule();
    } catch (error) {
      if (!active) return;
      if (error instanceof ApiError && error.status === 409) {
        state.pending = null;
        state.status = 'conflict';
        state.saveError = 'Проєкт змінився в іншій вкладці. Порівняйте тексти перед продовженням.';
      } else if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        state.pending = null;
        state.status = 'failed';
        state.saveError = workspaceError(
          error,
          'Не вдалося зберегти зміни. Текст залишився в редакторі.',
        );
      } else {
        state.status = 'outcome_unknown';
        state.saveError =
          'Не вдалося підтвердити збереження. Текст залишився в редакторі. Повторіть спробу після відновлення зв’язку.';
      }
    }
  }
  async function compare() {
    if (state.status !== 'conflict' || state.conflictLoading || state.conflict) return;
    state.conflictLoading = true;
    state.conflictError = '';
    try {
      const snapshot = await api.state(projectId, controller.signal);
      const files: ConflictFile[] = [];
      for (const [id, draft] of Object.entries(state.files)) {
        if (draft.base === draft.content) continue;
        const fileId = Number(id);
        const meta = snapshot.tree.find((f) => f.fileId === fileId && f.contentKind === 'text');
        const remote = meta
          ? (await api.text(projectId, fileId, snapshot.revision.id, controller.signal)).content
          : null;
        files.push({
          fileId,
          path: meta?.path ?? state.snapshot!.tree.find((f) => f.fileId === fileId)!.path,
          base: draft.base,
          local: draft.content,
          remote,
          merged: draft.content,
          useRemote: remote === null,
        });
      }
      if (active) state.conflict = { snapshot, files };
    } catch (error) {
      if (active)
        state.conflictError = workspaceError(
          error,
          'Не вдалося завантажити поточну версію. Спробуйте ще раз.',
        );
    } finally {
      if (active) state.conflictLoading = false;
    }
  }
  async function resolve() {
    const conflict = state.conflict;
    if (!conflict) return;
    // Keep only explicitly reviewed local edits; other files load from the new snapshot.
    state.files = {};
    for (const file of conflict.files) {
      if (file.remote !== null)
        state.files[file.fileId] = {
          base: file.remote,
          content: file.useRemote ? file.remote : file.merged,
        };
    }
    state.snapshot = conflict.snapshot;
    state.conflict = null;
    state.pending = null;
    state.saveError = '';
    state.resetKey++;
    state.status = dirty.value ? 'dirty' : 'clean';
    const selected = state.snapshot.tree.some((f) => f.fileId === state.selectedId)
      ? state.selectedId
      : state.snapshot.mainFileId;
    await select(selected);
    schedule();
  }
  function recover(): Recovery | null {
    if (!state.snapshot || !atRisk.value) return null;
    return structuredClone({
      snapshot: JSON.parse(JSON.stringify(state.snapshot)) as Snapshot,
      files: JSON.parse(JSON.stringify(state.files)) as Record<number, Draft>,
      pending: state.pending ? (JSON.parse(JSON.stringify(state.pending)) as Attempt) : null,
      status: state.status,
      conflict: state.conflict
        ? (JSON.parse(JSON.stringify(state.conflict)) as NonNullable<Recovery['conflict']>)
        : null,
    });
  }
  function dispose() {
    active = false;
    clearTimer();
    controller.abort();
    fileSequence++;
  }
  return {
    state,
    dirty,
    atRisk,
    load,
    select,
    edit,
    composition,
    save,
    compare,
    resolve,
    recover,
    dispose,
  };
}
