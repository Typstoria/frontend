import { afterEach, expect, it, vi } from 'vitest';
import { createWorkspacePreferences, defaultPanelSizes } from './workspace-preferences';

afterEach(() => vi.unstubAllGlobals());

it('shares panel sizes within an account and isolates project and account layouts', () => {
  const storage = new Map<string, string>();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  });
  const first = createWorkspacePreferences(1, 10);
  const sizes = { ...defaultPanelSizes, filesWidth: 300 };
  const project = {
    filesVisible: false,
    mode: 'preview' as const,
    tabs: ['context' as const, 1],
    activeTab: 'context' as const,
    pdf: { zoom: 2, anchor: { page: 3, x: 0.5, y: 0.2, gap: 0 } },
  };
  first.savePanels(sizes);
  first.saveProject(project);
  first.flush();

  expect(createWorkspacePreferences(1, 10).project).toEqual(project);
  expect(createWorkspacePreferences(1, 11).panels).toEqual(sizes);
  expect(createWorkspacePreferences(1, 11).project).toEqual({ filesVisible: true });
  expect(createWorkspacePreferences(2, 10).panels).toEqual(defaultPanelSizes);
  expect(createWorkspacePreferences(2, 10).project).toEqual({ filesVisible: true });
});

it('uses defaults and stays writable in memory when storage access throws', () => {
  vi.stubGlobal('window', {
    get localStorage() {
      throw new DOMException('Storage unavailable', 'SecurityError');
    },
  });
  const preferences = createWorkspacePreferences(1, 10);
  expect(preferences.panels).toEqual(defaultPanelSizes);
  expect(preferences.project).toEqual({ filesVisible: true });
  preferences.savePanels(defaultPanelSizes);
  expect(() => preferences.flush()).not.toThrow();
});
