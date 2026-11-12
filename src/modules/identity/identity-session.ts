import { readonly, shallowRef } from 'vue';
import { ApiError, createApiClient } from '../../shared/api/client';
import type { RequestOptions } from '../../shared/api/client';
import {
  createIdentityApi,
  parseAccount,
  parseMessage,
  parseLoginResponse,
  parseUser,
} from './identity-api';
import type { Credentials, LoginResponse, User } from './identity-api';

type EndReason = 'expired' | 'revoked' | 'logout' | 'password-changed' | null;

export const SESSION_STORAGE_KEY = 'typstoria.session';
type SessionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
function browserStorage(): SessionStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function createIdentitySession(
  request = createApiClient('/api'),
  storage: SessionStorage | null = browserStorage(),
  events: EventTarget | null = typeof window === 'undefined' ? null : window,
) {
  const api = createIdentityApi(request);
  const user = shallowRef<User | null>(null);
  const endReason = shallowRef<EndReason>(null);
  const logoutFailed = shallowRef(false);
  // Keep the in-use credential private; persistence is isolated to this auth service.
  let accessToken: string | null = null;
  let expiresAt = 0;
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function clear(reason: EndReason, publish = true) {
    generation++;
    if (timer) clearTimeout(timer);
    accessToken = null;
    expiresAt = 0;
    user.value = null;
    endReason.value = reason;
    logoutFailed.value = false;
    if (publish) {
      try {
        storage?.removeItem(SESSION_STORAGE_KEY);
      } catch {
        /* Storage may be disabled. */
      }
    }
  }

  function isAuthenticated() {
    if (accessToken && expiresAt <= Date.now()) clear('expired');
    return accessToken !== null;
  }

  function scheduleExpiry() {
    timer = setTimeout(
      () => {
        if (expiresAt <= Date.now()) clear('expired');
        else scheduleExpiry();
      },
      Math.min(expiresAt - Date.now(), 2147483647),
    );
  }

  function accept(result: LoginResponse, expectedGeneration: number, publish = true) {
    if (generation !== expectedGeneration)
      throw new DOMException('Session superseded', 'AbortError');
    if (Date.parse(result.expiresAt) <= Date.now()) {
      throw new ApiError(401, 'SESSION_EXPIRED', 'Строк дії сеансу закінчився.', null);
    }
    if (timer) clearTimeout(timer);
    accessToken = result.accessToken;
    expiresAt = Date.parse(result.expiresAt);
    user.value = result.user;
    endReason.value = null;
    logoutFailed.value = false;
    scheduleExpiry();
    if (publish) persist();
  }

  function persist() {
    if (!accessToken || !user.value) return;
    try {
      storage?.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({
          accessToken,
          tokenType: 'Bearer',
          expiresAt: new Date(expiresAt).toISOString(),
          user: parseUser(user.value),
        }),
      );
    } catch {
      /* Keep the valid in-memory session if browser storage is unavailable. */
    }
  }

  function restore() {
    let saved: string | null;
    try {
      saved = storage?.getItem(SESSION_STORAGE_KEY) ?? null;
    } catch {
      return;
    }
    if (!saved) {
      if (accessToken) clear('logout', false);
      return;
    }
    try {
      const result = parseLoginResponse(JSON.parse(saved));
      if (
        !/^[A-Za-z0-9._~-]{1,512}$/.test(result.accessToken) ||
        Date.parse(result.expiresAt) <= Date.now()
      ) {
        clear('expired');
        return;
      }
      if (accessToken === result.accessToken && expiresAt === Date.parse(result.expiresAt)) {
        if (JSON.stringify(parseUser(user.value)) !== JSON.stringify(result.user))
          user.value = result.user;
        return;
      }
      accept(result, ++generation, false);
    } catch {
      clear('revoked');
    }
  }
  function storageChanged(event: Event) {
    const change = event as StorageEvent;
    if (change.key !== SESSION_STORAGE_KEY && change.key !== null) return;
    // Read the newest value rather than applying an old queued cross-tab event.
    restore();
  }
  restore();
  events?.addEventListener('storage', storageChanged);

  async function signIn(load: () => Promise<LoginResponse>, signal?: AbortSignal) {
    const expected = ++generation;
    const result = await load();
    signal?.throwIfAborted();
    accept(result, expected);
  }

  async function authenticatedRequest(
    path: string,
    options: Omit<RequestOptions, 'accessToken'> = {},
  ) {
    if (!isAuthenticated()) throw new ApiError(401, 'SESSION_EXPIRED', 'Увійдіть знову.', null);
    const expected = generation;
    try {
      const result = await request(path, { ...options, accessToken: accessToken! });
      if (expected !== generation) throw new DOMException('Session superseded', 'AbortError');
      return result;
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.status === 401 || error.code === 'EMAIL_NOT_VERIFIED') &&
        expected === generation
      )
        clear('revoked');
      throw error;
    }
  }

  return {
    user: readonly(user),
    endReason: readonly(endReason),
    logoutFailed: readonly(logoutFailed),
    api,
    isAuthenticated,
    request: authenticatedRequest,
    login: (credentials: Credentials, signal?: AbortSignal) =>
      signIn(() => api.login(credentials, signal), signal),
    google: (idToken: string, signal?: AbortSignal) =>
      signIn(() => api.google(idToken, signal), signal),
    async refreshProfile(signal?: AbortSignal) {
      const expected = generation;
      const profile = parseAccount(
        await authenticatedRequest('/auth/me', signal ? { signal } : {}),
      );
      if (expected === generation) {
        user.value = profile;
        persist();
      }
      return profile;
    },
    async updateProfile(name: string, signal?: AbortSignal) {
      const profile = parseAccount(
        await authenticatedRequest('/auth/me', {
          method: 'PATCH',
          body: { name },
          ...(signal ? { signal } : {}),
        }),
      );
      user.value = profile;
      persist();
      return profile;
    },
    async changePassword(currentPassword: string, newPassword: string, signal?: AbortSignal) {
      await authenticatedRequest('/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
        ...(signal ? { signal } : {}),
      });
      clear('password-changed');
    },
    async requestAccountDeletion(signal?: AbortSignal) {
      parseMessage(
        await authenticatedRequest('/auth/request-account-deletion', {
          method: 'POST',
          ...(signal ? { signal } : {}),
        }),
      );
    },
    async logout() {
      if (!isAuthenticated()) {
        clear('logout');
        return;
      }
      const token = accessToken!;
      // Clear locally immediately; an old response must never clear a newer login.
      clear('logout');
      const expected = generation;
      try {
        await request('/auth/logout', { method: 'POST', accessToken: token });
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 401)) {
          if (generation === expected) logoutFailed.value = true;
          throw error;
        }
      }
    },
    invalidate: () => clear('revoked'),
    dispose() {
      if (timer) clearTimeout(timer);
      events?.removeEventListener('storage', storageChanged);
    },
  };
}

export const identitySession = createIdentitySession();
