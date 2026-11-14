import type { Recovery } from './workspace-model';
import type { RestoredRevision, RestoreInput } from './history-api';

export type RestoreAttempt = { body: RestoreInput; key: string; result?: RestoredRevision };

let exitGuard: (() => boolean) | null = null;
let recovery: { userId: number; projectId: number; draft: Recovery } | null = null;
let restoreRecovery: { userId: number; projectId: number; attempt: RestoreAttempt } | null = null;
export function registerWorkspaceExit(guard: () => boolean) {
  exitGuard = guard;
  return () => {
    if (exitGuard === guard) exitGuard = null;
  };
}
export function allowWorkspaceLogout() {
  const allowed = exitGuard?.() ?? true;
  if (allowed) {
    recovery = null;
    restoreRecovery = null;
  }
  return allowed;
}
// Memory only: an expired session can recover its draft in this tab, for the same account.
export function retainWorkspace(userId: number, projectId: number, draft: Recovery | null) {
  recovery = draft ? { userId, projectId, draft } : null;
}
export function clearOtherAccountDraft(userId: number) {
  if (recovery && recovery.userId !== userId) recovery = null;
  if (restoreRecovery && restoreRecovery.userId !== userId) restoreRecovery = null;
}
export function takeWorkspaceRecovery(userId: number, projectId: number) {
  clearOtherAccountDraft(userId);
  if (recovery?.projectId !== projectId) return undefined;
  const draft = recovery.draft;
  recovery = null;
  return draft;
}

export function retainWorkspaceRestore(userId: number, projectId: number, attempt: RestoreAttempt) {
  restoreRecovery = { userId, projectId, attempt };
}
export function takeWorkspaceRestore(userId: number, projectId: number) {
  clearOtherAccountDraft(userId);
  if (restoreRecovery?.projectId !== projectId) return null;
  const { attempt } = restoreRecovery;
  restoreRecovery = null;
  return attempt;
}
