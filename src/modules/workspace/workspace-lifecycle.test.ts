import { afterEach, expect, it } from 'vitest';
import {
  allowWorkspaceLogout,
  registerWorkspaceExit,
  retainWorkspace,
  takeWorkspaceRecovery,
  clearOtherAccountDraft,
} from './workspace-lifecycle';
import type { Recovery } from './workspace-model';

const draft: Recovery = {
  snapshot: {
    project: {
      id: 10,
      title: 'Private',
      currentRevisionId: 20,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    revision: {
      id: 20,
      number: 1,
      parentRevisionId: null,
      createdAt: '2026-01-01',
      commitSha: null,
      manifestHash: 'a'.repeat(64),
      historySyncStatus: 'pending',
    },
    tree: [],
    mainFileId: 30,
    contextText: '',
  },
  files: { 30: { base: '', content: 'private draft' } },
  pending: null,
  status: 'dirty',
  conflict: null,
  structure: [],
  structureLabels: [],
};
let unregister = () => {};
afterEach(() => {
  unregister();
  allowWorkspaceLogout();
});

it('recovers a draft once for the same account/project and clears it for another account', () => {
  retainWorkspace(1, 10, draft);
  expect(takeWorkspaceRecovery(1, 11)).toBeUndefined();
  expect(takeWorkspaceRecovery(1, 10)).toBe(draft);
  expect(takeWorkspaceRecovery(1, 10)).toBeUndefined();
  retainWorkspace(1, 10, draft);
  clearOtherAccountDraft(2);
  expect(takeWorkspaceRecovery(1, 10)).toBeUndefined();
});
it('keeps recovery on cancelled logout and clears it only after the user accepts logout', () => {
  retainWorkspace(1, 10, draft);
  unregister = registerWorkspaceExit(() => false);
  expect(allowWorkspaceLogout()).toBe(false);
  expect(takeWorkspaceRecovery(1, 10)).toBe(draft);
  retainWorkspace(1, 10, draft);
  unregister();
  unregister = registerWorkspaceExit(() => true);
  expect(allowWorkspaceLogout()).toBe(true);
  expect(takeWorkspaceRecovery(1, 10)).toBeUndefined();
});
