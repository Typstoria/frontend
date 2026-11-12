import type { Recovery } from './workspace-model';

let exitGuard: (() => boolean) | null = null;
let recovery: { userId: number; projectId: number; draft: Recovery } | null = null;
export function registerWorkspaceExit(guard: () => boolean) {
  exitGuard = guard;
  return () => {
    if (exitGuard === guard) exitGuard = null;
  };
}
export function allowWorkspaceLogout() {
  const allowed = exitGuard?.() ?? true;
  if (allowed) recovery = null;
  return allowed;
}
// Memory only: an expired session can recover its draft in this tab, for the same account.
export function retainWorkspace(userId: number, projectId: number, draft: Recovery | null) {
  recovery = draft ? { userId, projectId, draft } : null;
}
export function clearOtherAccountDraft(userId: number) {
  if (recovery && recovery.userId !== userId) recovery = null;
}
export function takeWorkspaceRecovery(userId: number, projectId: number) {
  clearOtherAccountDraft(userId);
  if (recovery?.projectId !== projectId) return undefined;
  const draft = recovery.draft;
  recovery = null;
  return draft;
}
