<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { EditorState } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';

const props = defineProps<{
  modelValue: string;
  documentId: number;
  readonly?: boolean;
  resetKey?: number;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  save: [];
  composition: [active: boolean];
}>();

const host = ref<HTMLElement | null>(null);
const states = new Map<number, EditorState>();
const scrollSnapshots = new Map<number, ReturnType<EditorView['scrollSnapshot']>>();
let view: EditorView | undefined;
let modules: typeof import('@codemirror/view') | undefined;
let stateModule: typeof import('@codemirror/state') | undefined;
let readonlyCompartment: import('@codemirror/state').Compartment | undefined;
let baseExtensions: import('@codemirror/state').Extension[] = [];
let activeDocumentId = props.documentId;
let composing = false;
let destroyed = false;
let syncingExternalValue = false;

function dispatchExternalValue(value: string) {
  if (!view || view.state.doc.toString() === value) return;
  syncingExternalValue = true;
  try {
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
  } finally {
    syncingExternalValue = false;
  }
}

function reconfigureReadonly(readonly: boolean) {
  if (!view || !modules || !stateModule || !readonlyCompartment) return;
  view.dispatch({
    effects: readonlyCompartment.reconfigure([
      stateModule.EditorState.readOnly.of(readonly),
      modules.EditorView.editable.of(!readonly),
    ]),
  });
}
function restoreScroll(documentId: number) {
  if (!view || !modules) return;
  view.dispatch({
    effects:
      scrollSnapshots.get(documentId) ?? modules.EditorView.scrollIntoView(0, { y: 'start' }),
  });
}

async function initialize() {
  const [loadedStateModule, viewModule, commandsModule] = await Promise.all([
    import('@codemirror/state'),
    import('@codemirror/view'),
    import('@codemirror/commands'),
  ]);
  if (destroyed || !host.value) return;
  stateModule = loadedStateModule;
  modules = viewModule;
  readonlyCompartment = new loadedStateModule.Compartment();

  baseExtensions = [
    commandsModule.history(),
    viewModule.lineNumbers(),
    viewModule.highlightActiveLine(),
    viewModule.highlightActiveLineGutter(),
    viewModule.keymap.of([
      {
        key: 'Mod-s',
        run: () => {
          emit('save');
          return true;
        },
      },
      {
        key: 'Tab',
        run: (editor) => {
          if (editor.state.readOnly) return false;
          editor.dispatch(editor.state.replaceSelection('  '));
          return true;
        },
      },
      {
        key: 'Escape',
        run: (editor) => {
          commandsModule.simplifySelection(editor);
          editor.setTabFocusMode(2000);
          return true;
        },
      },
      ...commandsModule.historyKeymap,
      ...commandsModule.defaultKeymap,
    ]),
    viewModule.EditorView.lineWrapping,
    loadedStateModule.EditorState.tabSize.of(2),
    readonlyCompartment.of([
      loadedStateModule.EditorState.readOnly.of(Boolean(props.readonly)),
      viewModule.EditorView.editable.of(!props.readonly),
    ]),
    viewModule.EditorView.contentAttributes.of({
      'aria-label': 'Вихідний текст',
      'aria-description': 'Щоб вийти з редактора, натисніть Escape, потім Tab.',
    }),
    viewModule.EditorView.updateListener.of((update) => {
      states.set(activeDocumentId, update.state);
      if (update.docChanged && !syncingExternalValue) {
        emit('update:modelValue', update.state.doc.toString());
      }
    }),
  ];

  const cached = states.get(props.documentId);
  const state = cached
    ? cached
    : loadedStateModule.EditorState.create({
        doc: props.modelValue,
        extensions: baseExtensions,
      });

  view = new viewModule.EditorView({ state, parent: host.value });
  view.contentDOM.addEventListener('compositionstart', onCompositionStart);
  view.contentDOM.addEventListener('compositionend', onCompositionEnd);
  activeDocumentId = props.documentId;
  states.set(activeDocumentId, view.state);
  if (cached) dispatchExternalValue(props.modelValue);
}

function onCompositionStart() {
  composing = true;
  emit('composition', true);
}

function onCompositionEnd() {
  composing = false;
  emit('composition', false);
}

watch(
  () => [props.documentId, props.modelValue, props.resetKey] as const,
  ([documentId, modelValue, resetKey], previous) => {
    if (!view || !modules || !readonlyCompartment) return;

    const previousResetKey = previous?.[2];
    if (previous && resetKey !== previousResetKey && stateModule) {
      states.clear();
      scrollSnapshots.clear();
      activeDocumentId = documentId;
      view.setState(
        stateModule.EditorState.create({ doc: modelValue, extensions: baseExtensions }),
      );
      reconfigureReadonly(Boolean(props.readonly));
      restoreScroll(documentId);
      states.set(activeDocumentId, view.state);
      return;
    }

    if (documentId !== activeDocumentId) {
      states.set(activeDocumentId, view.state);
      scrollSnapshots.set(activeDocumentId, view.scrollSnapshot());
      activeDocumentId = documentId;
      const next = states.get(documentId);
      if (next) {
        view.setState(next);
        reconfigureReadonly(Boolean(props.readonly));
        dispatchExternalValue(modelValue);
        restoreScroll(documentId);
      } else if (stateModule) {
        view.setState(
          stateModule.EditorState.create({ doc: modelValue, extensions: baseExtensions }),
        );
        reconfigureReadonly(Boolean(props.readonly));
        states.set(documentId, view.state);
        restoreScroll(documentId);
      }
      return;
    }

    dispatchExternalValue(modelValue);
  },
);

watch(
  () => props.readonly,
  (readonly) => {
    if (!view || !readonlyCompartment) return;
    reconfigureReadonly(Boolean(readonly));
  },
);

onMounted(() => void initialize());
defineExpose({ focus: () => view?.focus() });

onBeforeUnmount(() => {
  destroyed = true;
  if (view) {
    states.set(activeDocumentId, view.state);
    view.contentDOM.removeEventListener('compositionstart', onCompositionStart);
    view.contentDOM.removeEventListener('compositionend', onCompositionEnd);
    view.destroy();
  }
  if (composing) emit('composition', false);
});
</script>

<template>
  <div ref="host" class="text-editor" />
</template>

<style>
.text-editor,
.text-editor .cm-editor {
  min-height: 100%;
  height: 100%;
}

.text-editor .cm-editor {
  font: inherit;
}

.text-editor .cm-scroller {
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.text-editor .cm-content {
  padding: 1rem 0;
}
</style>
