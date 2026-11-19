import { MAX_PDF_SCALE, MIN_PDF_SCALE, type PdfView } from './pdf-layout';
import { validId } from './workspace-api';

export type ViewMode = 'code' | 'split' | 'preview';
export type TabId = number | 'context';
export type PanelSizes = {
  filesWidth: number;
  codeRatio: number;
  diagnosticsHeight: number | null;
};
export type ProjectLayout = {
  filesVisible: boolean;
  mode?: ViewMode;
  tabs?: TabId[];
  activeTab?: TabId | null;
  pdf?: PdfView;
};

export const defaultPanelSizes: Readonly<PanelSizes> = {
  filesWidth: 240,
  codeRatio: 1 / 1.88,
  diagnosticsHeight: null,
};

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function inRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function tabId(value: unknown): value is TabId {
  return value === 'context' || validId(value);
}

function pdfView(value: unknown): PdfView {
  const { zoom, anchor } = record(value);
  const { page, x, y, gap } = record(anchor);
  return {
    zoom: inRange(zoom, MIN_PDF_SCALE, MAX_PDF_SCALE) ? zoom : null,
    anchor:
      inRange(page, 0, Number.MAX_SAFE_INTEGER) &&
      Number.isInteger(page) &&
      inRange(x, 0, 1) &&
      inRange(y, 0, 1) &&
      inRange(gap, -64, 0)
        ? { page, x, y, gap }
        : null,
  };
}

export function createWorkspacePreferences(ownerId: number, projectId: number) {
  const accountKey = `typstoria.workspace.v1:${ownerId}`;
  const projectKey = `${accountKey}:${projectId}`;

  function read(key: string) {
    try {
      return record(JSON.parse(window.localStorage.getItem(key) ?? '{}'));
    } catch {
      return {};
    }
  }

  function save(key: string, value: PanelSizes | ProjectLayout) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Layout remains usable for the current session without local storage.
    }
  }

  function writer<T extends PanelSizes | ProjectLayout>(key: string) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending: T | undefined;
    function flush() {
      clearTimeout(timer);
      if (pending) save(key, pending);
      pending = undefined;
    }
    return {
      queue(value: T) {
        pending = value;
        clearTimeout(timer);
        timer = setTimeout(flush, 200);
      },
      flush,
    };
  }

  const account = read(accountKey);
  const project = read(projectKey);
  const { mode } = project;
  const storedProject: ProjectLayout = {
    filesVisible: project.filesVisible !== false,
    ...(mode === 'code' || mode === 'split' || mode === 'preview' ? { mode } : {}),
    ...(Array.isArray(project.tabs)
      ? { tabs: [...new Set(project.tabs.slice(0, 501).filter(tabId))] }
      : {}),
    ...(project.activeTab === null || tabId(project.activeTab)
      ? { activeTab: project.activeTab }
      : {}),
    ...(project.pdf ? { pdf: pdfView(project.pdf) } : {}),
  };
  const panels = writer<PanelSizes>(accountKey);
  const layout = writer<ProjectLayout>(projectKey);
  return {
    panels: {
      filesWidth: inRange(account.filesWidth, 160, 420)
        ? account.filesWidth
        : defaultPanelSizes.filesWidth,
      codeRatio: inRange(account.codeRatio, 0, 1) ? account.codeRatio : defaultPanelSizes.codeRatio,
      diagnosticsHeight: inRange(account.diagnosticsHeight, 64, 480)
        ? account.diagnosticsHeight
        : null,
    } satisfies PanelSizes,
    project: storedProject,
    savePanels: panels.queue,
    saveProject: layout.queue,
    flush() {
      panels.flush();
      layout.flush();
    },
  };
}
