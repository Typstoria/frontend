import { computed, reactive } from 'vue';
import { ApiError } from '../../shared/api/client';
import type { Changes, Snapshot, SaveResult, StructureChange, WorkspaceApi } from './workspace-api';
import { structureError } from './file-structure';

type Draft = { base: string; content: string };
type Attempt = { body: Changes; key: string; result?: SaveResult; selectPath?: string };
type SaveStatus =
  'clean' | 'dirty' | 'saving' | 'failed' | 'outcome_unknown' | 'refresh_failed' | 'conflict';
type StructureChoice = {
  operations: StructureChange[];
  description: string;
  include: boolean;
  error: string;
};
type Conflict = { snapshot: Snapshot; files: ConflictFile[]; structure: StructureChoice[] };
export type Recovery = {
  snapshot: Snapshot;
  files: Record<number, Draft>;
  pending: Attempt | null;
  status: SaveStatus;
  conflict: Conflict | null;
  structure: StructureChange[];
  structureLabels: string[];
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
export function describeStructure(operation: StructureChange, files: Snapshot['tree']): string {
  const source =
    'fileId' in operation
      ? (files.find((file) => file.fileId === operation.fileId)?.path ?? 'Недоступний файл')
      : '';
  if (operation.type === 'createFile') return `Створити ${operation.path}`;
  if (operation.type === 'renameFile') return `Перейменувати ${source} → ${operation.path}`;
  if (operation.type === 'deleteFile') return `Видалити ${source}`;
  return `Головний файл: ${operation.path}`;
}

export function workspaceError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 404) return 'Проєкт або файл недоступний.';
    if (error.status === 401) return 'Сеанс завершився. Увійдіть знову, щоб продовжити.';
    if (error.status === 403) return 'Немає доступу до цього проєкту.';
    if (error.status === 413) return 'Зміни завеликі. Зменште обсяг тексту.';
    if (error.status === 429) return 'Забагато запитів. Спробуйте трохи пізніше.';
    if (error.status === 422)
      return 'Не вдалося застосувати зміни файлів. Перевірте шляхи та головний файл.';
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
    structure: [] as StructureChange[],
    structureLabels: [] as string[],
    conflict: null as Conflict | null,
    conflictLoading: false,
    conflictError: '',
    resetKey: 0,
  });
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active = true;
  let composing = false;
  let fileSequence = 0;
  const dirty = computed(
    () =>
      state.structure.length > 0 || Object.values(state.files).some((f) => f.base !== f.content),
  );
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
        state.structure = recovery.structure;
        state.structureLabels = recovery.structureLabels;
        state.status = recovery.pending
          ? recovery.pending.result
            ? 'refresh_failed'
            : 'outcome_unknown'
          : recovery.status === 'conflict'
            ? 'conflict'
            : recovery.status === 'failed' && state.structure.length
              ? 'failed'
              : dirty.value
                ? 'dirty'
                : 'clean';
        if (state.pending)
          state.saveError = state.pending.result
            ? 'Зміни збережено. Не вдалося оновити список файлів. Повторіть оновлення.'
            : 'Результат попереднього збереження невідомий. Повторіть його перед наступними змінами.';
        else if (state.status === 'conflict')
          state.saveError =
            'Проєкт змінився в іншій вкладці. Порівняйте тексти перед продовженням.';
        else if (state.status === 'failed' && state.structure.length)
          state.saveError =
            'Зміни файлів не застосовано. Перевірте дію та повторіть або скасуйте її.';
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
    if (
      !file ||
      state.conflict ||
      state.conflictLoading ||
      state.structure.some((op) => op.type === 'deleteFile' && op.fileId === fileId)
    )
      return;
    file.content = content;
    if (
      ['clean', 'dirty', 'failed'].includes(state.status) &&
      !(state.status === 'failed' && state.structure.length)
    ) {
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
      const error = state.structure.length ? structureError(state.structure, state.snapshot) : '';
      if (error) {
        state.status = 'failed';
        state.saveError = error;
        return;
      }
      const deleted = new Set(
        state.structure.filter((op) => op.type === 'deleteFile').map((op) => op.fileId),
      );
      const operations: Changes['operations'] = Object.entries(state.files)
        .filter(([id, f]) => f.base !== f.content && !deleted.has(Number(id)))
        .map(([fileId, f]) => ({
          type: 'updateText' as const,
          fileId: Number(fileId),
          content: f.content,
        }));
      operations.push(...(JSON.parse(JSON.stringify(state.structure)) as StructureChange[]));
      if (!operations.length) {
        state.status = 'clean';
        return;
      }
      const body: Changes = { baseRevisionId: state.snapshot.revision.id, operations };
      const bytes = new TextEncoder();
      if (
        operations.length > 200 ||
        operations.some((o) => 'content' in o && bytes.encode(o.content).length > 1048576) ||
        bytes.encode(JSON.stringify(body)).length > 8 * 1048576
      ) {
        state.status = 'failed';
        state.saveError =
          'Зміни завеликі: до 1 МіБ тексту на файл, 200 файлів і 8 МіБ на збереження. Зменште обсяг або завантажте копію.';
        return;
      }
      const created = state.structure.find((op) => op.type === 'createFile');
      state.pending = {
        body,
        key: crypto.randomUUID(),
        ...(created ? { selectPath: created.path.normalize('NFC') } : {}),
      };
    }
    const attempt = state.pending;
    state.status = 'saving';
    state.saveError = '';
    try {
      const result =
        attempt.result ?? (await api.save(projectId, attempt.body, attempt.key, controller.signal));
      if (!active) return;
      attempt.result = result;
      const structural = attempt.body.operations.some((op) => op.type !== 'updateText');
      const snapshot = structural
        ? await api.state(projectId, controller.signal, result.revisionId)
        : null;
      if (!active) return;
      for (const change of attempt.body.operations) {
        if (change.type === 'updateText' && state.files[change.fileId])
          state.files[change.fileId]!.base = change.content;
        if (change.type === 'createFile') {
          const file = result.createdFiles.find(
            (file) => file.path === change.path.normalize('NFC'),
          );
          if (
            !file ||
            !snapshot?.tree.some(
              (meta) =>
                meta.fileId === file.fileId &&
                meta.path === file.path &&
                meta.contentKind === 'text',
            )
          )
            throw new ApiError(200, 'INVALID_RESPONSE', '', null);
          state.files[file.fileId] = { base: change.content, content: change.content };
        }
      }
      if (snapshot) {
        state.snapshot = snapshot;
        for (const id of Object.keys(state.files))
          if (
            !snapshot.tree.some((file) => file.fileId === Number(id) && file.contentKind === 'text')
          )
            delete state.files[Number(id)];
      } else {
        state.snapshot.revision.id = result.revisionId;
        state.snapshot.revision.number = result.revisionNumber;
        state.snapshot.revision.manifestHash = result.manifestHash;
        state.snapshot.project.currentRevisionId = result.revisionId;
      }
      state.structure = [];
      state.structureLabels = [];
      state.pending = null;
      state.status = dirty.value ? 'dirty' : 'clean';
      const newFile = attempt.selectPath
        ? state.snapshot.tree.find((file) => file.path === attempt.selectPath)
        : undefined;
      if (newFile || !state.snapshot.tree.some((file) => file.fileId === state.selectedId))
        await select(newFile?.fileId ?? state.snapshot.mainFileId);
      schedule();
    } catch (error) {
      if (!active) return;
      if (attempt.result) {
        state.status = 'refresh_failed';
        state.saveError = 'Зміни збережено. Не вдалося оновити список файлів. Повторіть оновлення.';
      } else if (error instanceof ApiError && error.status === 409) {
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
  async function mutate(operations: StructureChange[]) {
    if (
      !active ||
      composing ||
      !state.snapshot ||
      state.fileLoading ||
      state.pending ||
      state.conflict ||
      state.conflictLoading ||
      ['saving', 'conflict'].includes(state.status)
    )
      return false;
    clearTimer();
    state.structure = JSON.parse(JSON.stringify(operations)) as StructureChange[];
    state.structureLabels = operations.map((operation) =>
      describeStructure(operation, state.snapshot!.tree),
    );
    state.status = 'dirty';
    await save();
    return !state.pending && state.structure.length === 0;
  }
  function cancelStructure() {
    if (state.pending || ['saving', 'conflict'].includes(state.status)) return;
    state.structure = [];
    state.structureLabels = [];
    state.saveError = '';
    state.status = dirty.value ? 'dirty' : 'clean';
    schedule();
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
      if (active)
        state.conflict = {
          snapshot,
          files,
          structure: state.structure.length
            ? [
                {
                  operations: JSON.parse(JSON.stringify(state.structure)) as StructureChange[],
                  description: state.structureLabels.join(' · '),
                  include: false,
                  error: structureError(state.structure, snapshot),
                },
              ]
            : [],
        };
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
    const structure = conflict.structure.filter((choice) => choice.include && !choice.error);
    state.structure = structure.flatMap((choice) => choice.operations);
    state.structureLabels = state.structure.map((operation) =>
      describeStructure(operation, state.snapshot!.tree),
    );
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
      structure: JSON.parse(JSON.stringify(state.structure)) as StructureChange[],
      structureLabels: [...state.structureLabels],
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
    mutate,
    cancelStructure,
    compare,
    resolve,
    recover,
    dispose,
  };
}
