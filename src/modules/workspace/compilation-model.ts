import { reactive } from 'vue';
import { ApiError } from '../../shared/api/client';
import type { Compilation, CompilationApi, Diagnostic } from './compilation-api';
import { workspaceError } from './workspace-model';

type Revision = { id: number; number: number };
type Artifact = { job: Compilation; revision: Revision; pdf: Blob };
type Retry = 'status' | 'pdf' | 'startup' | null;
type DiagnosticResult = {
  jobId: number;
  revisionId: number;
  revisionNumber: number;
  items: Diagnostic[];
};
const activeJob = (job: Compilation) => job.status === 'queued' || job.status === 'running';
export const compilationRetryLabels = {
  status: 'Перевірити статус',
  pdf: 'Повторити завантаження',
  startup: 'Повторити',
};

export function compilationFailure(job: Compilation) {
  if (job.status === 'timed_out') return 'Компіляція тривала задовго. Спробуйте ще раз.';
  if (job.status === 'cancelled') return 'Компіляцію скасовано.';
  switch (job.errorCode) {
    case 'TYPST_ERROR':
      return 'Typst не зміг скомпілювати документ.';
    case 'DEPENDENCY_UNAVAILABLE':
      return 'Для компіляції бракує пакета. Перевірте імпорти у файлах.';
    case 'OUTPUT_LIMIT':
    case 'RESOURCE_LIMIT':
      return 'Документ перевищив ліміт компіляції. Спробуйте зменшити його обсяг.';
    default:
      return 'Не вдалося скомпілювати документ. Спробуйте пізніше.';
  }
}

export function createCompilationModel(api: CompilationApi) {
  const state = reactive({
    job: null as Compilation | null,
    revision: null as Revision | null,
    artifact: null as Artifact | null,
    diagnostics: null as DiagnosticResult | null,
    busy: false,
    error: '',
    retry: null as Retry,
    startupStage: null as 'lookup' | 'ensure' | null,
  });
  let controller: AbortController | undefined;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  function pause(ms: number, signal: AbortSignal) {
    return new Promise<void>((resolve) => {
      const timer = setTimeout(finish, ms);
      function finish() {
        clearTimeout(timer);
        signal.removeEventListener('abort', finish);
        resolve();
      }
      signal.addEventListener('abort', finish, { once: true });
    });
  }

  function setArtifact(artifact: Artifact) {
    clearTimeout(expiry);
    state.artifact = artifact;
    const expire = () => {
      if (state.artifact?.job.id !== artifact.job.id) return;
      state.artifact = null;
      if (state.job?.id === artifact.job.id && !state.busy) {
        state.error = 'Термін дії PDF минув. Скомпілюйте документ ще раз.';
        state.retry = null;
      }
    };
    expiry = setTimeout(
      expire,
      Math.max(0, Date.parse(artifact.job.artifactExpiresAt!) - Date.now()),
    );
  }

  async function fetchPdf(
    job: Compilation,
    revision: Revision,
    signal: AbortSignal,
    onUnavailable?: () => void,
  ) {
    if (!job.artifactAvailable || Date.parse(job.artifactExpiresAt!) <= Date.now()) {
      state.error = 'PDF більше недоступний. Скомпілюйте документ ще раз.';
      onUnavailable?.();
      return;
    }
    try {
      const pdf = await api.pdf(job, signal);
      if (signal.aborted) return;
      if (Date.parse(job.artifactExpiresAt!) <= Date.now()) {
        state.error = 'Термін дії PDF минув. Скомпілюйте документ ще раз.';
        onUnavailable?.();
        return;
      }
      if (!state.artifact || state.artifact.revision.number <= revision.number)
        setArtifact({ job, revision, pdf });
    } catch (error) {
      if (signal.aborted) return;
      if (error instanceof ApiError && error.code === 'ARTIFACT_UNAVAILABLE') {
        state.error = 'PDF більше недоступний. Скомпілюйте документ ще раз.';
        onUnavailable?.();
        return;
      }
      state.error = workspaceError(error, 'Не вдалося завантажити PDF.');
      state.retry = 'pdf';
    }
  }

  async function track(
    job: Compilation,
    revision: Revision,
    signal: AbortSignal,
    onUnavailable?: () => void,
  ) {
    const deadline = Date.now() + 120_000;
    let delay = 600;
    let failures = 0;
    while (!signal.aborted && activeJob(job) && Date.now() < deadline) {
      await pause(delay, signal);
      if (signal.aborted) return;
      try {
        job = await api.status(job, signal);
        if (signal.aborted) return;
        state.job = job;
        failures = 0;
      } catch (error) {
        if (signal.aborted) return;
        const unavailable = error instanceof ApiError && [401, 403, 404].includes(error.status);
        if (unavailable || ++failures >= 3) {
          state.error = workspaceError(error, 'Не вдалося перевірити статус компіляції.');
          state.retry = unavailable ? null : 'status';
          return;
        }
      }
      delay = Math.min(delay * 2, 5000);
    }
    if (signal.aborted) return;
    if (activeJob(job)) {
      state.error = 'Компіляція ще триває. Статус можна перевірити знову.';
      state.retry = 'status';
      return;
    }
    if (state.diagnostics?.jobId !== job.id) {
      const items = [...job.diagnostics];
      if (job.status !== 'succeeded' && !items.some((item) => item.severity === 'error'))
        items.unshift({
          severity: 'error',
          message: compilationFailure(job),
          fileId: null,
          path: null,
          range: null,
        });
      state.diagnostics = {
        jobId: job.id,
        revisionId: revision.id,
        revisionNumber: revision.number,
        items,
      };
    }
    if (job.status === 'succeeded') await fetchPdf(job, revision, signal, onUnavailable);
  }

  async function run(action: (signal: AbortSignal) => Promise<void>) {
    controller?.abort();
    controller = new AbortController();
    const { signal } = controller;
    state.busy = true;
    state.error = '';
    state.retry = null;
    state.startupStage = null;
    try {
      await action(signal);
    } finally {
      state.startupStage = null;
      if (!signal.aborted) state.busy = false;
    }
  }

  async function start(revision: Revision) {
    if (state.busy || disposed) return;
    state.revision = revision;
    state.job = null;
    await run(async (signal) => {
      let job: Compilation;
      try {
        job = await api.start(revision.id, signal);
      } catch (error) {
        if (!signal.aborted)
          state.error = workspaceError(
            error,
            'Не вдалося підтвердити запуск компіляції. Спробуйте ще раз.',
          );
        return;
      }
      if (signal.aborted) return;
      state.job = job;
      await track(job, revision, signal);
    });
  }

  async function openStartup() {
    if (state.busy || disposed) return;
    await run(async (signal) => {
      for (let attempt = 0; attempt < 2; attempt++) {
        let startup;
        state.startupStage = 'lookup';
        try {
          startup = await api.latestPdf(signal);
          if (signal.aborted) return;
          if (!startup) {
            state.startupStage = 'ensure';
            startup = await api.ensure(signal);
          }
        } catch (error) {
          if (!signal.aborted) {
            state.error = workspaceError(error, 'Не вдалося відкрити PDF. Спробуйте ще раз.');
            state.retry = 'startup';
          }
          return;
        }
        if (signal.aborted || disposed) return;
        state.startupStage = null;
        const revision = { id: startup.job.revisionId, number: startup.revisionNumber };
        state.revision = revision;
        state.job = startup.job;
        state.error = '';
        let unavailable = false;
        await track(startup.job, revision, signal, () => {
          unavailable = true;
        });
        if (!unavailable || attempt === 1 || signal.aborted) return;
        // Expiry can race the lookup/download. Recheck once; generic network or
        // storage failures never become a reason to queue another compilation.
        state.error = '';
        state.retry = null;
      }
    });
  }

  async function retry() {
    const { job, revision, retry } = state;
    if (!retry || state.busy || disposed) return;
    if (retry === 'startup') return openStartup();
    if (!job || !revision) return;
    await run((signal) =>
      retry === 'status' ? track(job, revision, signal) : fetchPdf(job, revision, signal),
    );
  }

  function dispose() {
    disposed = true;
    controller?.abort();
    clearTimeout(expiry);
    state.artifact = null;
  }

  return { state, start, openStartup, retry, dispose };
}
