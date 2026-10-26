import { readonly, shallowRef } from 'vue';
import { ApiError, createApiClient } from '../../shared/api/client';
import type { RequestOptions } from '../../shared/api/client';
import { createIdentityApi, parseUser, parseMessage } from './identity-api';
import type { Credentials, LoginResponse, User } from './identity-api';

type EndReason = 'expired' | 'revoked' | 'logout' | null;

export function createIdentitySession(request = createApiClient('/api')) {
  const api = createIdentityApi(request);
  const user = shallowRef<User | null>(null);
  const endReason = shallowRef<EndReason>(null);
  const logoutFailed = shallowRef(false);
  // Never expose the credential as reactive state or write it to browser storage.
  let accessToken: string | null = null;
  let expiresAt = 0;
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function clear(reason: EndReason) {
    generation++;
    if (timer) clearTimeout(timer);
    accessToken = null;
    expiresAt = 0;
    user.value = null;
    endReason.value = reason;
    logoutFailed.value = false;
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

  function accept(result: LoginResponse, expectedGeneration: number) {
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
  }

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
    login: (credentials: Credentials, signal?: AbortSignal) =>
      signIn(() => api.login(credentials, signal), signal),
    google: (idToken: string, signal?: AbortSignal) =>
      signIn(() => api.google(idToken, signal), signal),
    async refreshProfile(signal?: AbortSignal) {
      const expected = generation;
      const profile = parseUser(await authenticatedRequest('/auth/me', signal ? { signal } : {}));
      if (expected === generation) user.value = profile;
    },
    async linkGoogle(idToken: string, signal?: AbortSignal) {
      parseMessage(
        await authenticatedRequest('/auth/google/link', {
          method: 'POST',
          body: { idToken },
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
  };
}

export const identitySession = createIdentitySession();
