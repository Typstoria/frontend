import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from '../../shared/api/client';
import { parseLoginResponse, parseUser } from './identity-api';
import { createIdentitySession } from './identity-session';

const user = {
  id: 1,
  email: 'writer@example.com',
  emailVerified: true,
  name: null,
  createdAt: '2026-01-01T00:00:00Z',
};
function login(email = user.email, token = '1.test-secret') {
  return {
    user: { ...user, email },
    accessToken: token,
    tokenType: 'Bearer',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { promise, resolve, reject };
}
const sessions: ReturnType<typeof createIdentitySession>[] = [];
function setup(request: ReturnType<typeof createApiClient>) {
  const session = createIdentitySession(request);
  sessions.push(session);
  return session;
}
afterEach(() => {
  sessions.splice(0).forEach((session) => session.invalidate());
  vi.useRealTimers();
});

describe('identity response boundary', () => {
  it('rejects malformed IDs, unverified login and invalid expiry', () => {
    expect(() => parseUser({ ...user, id: '1' })).toThrow(ApiError);
    expect(() => parseUser({ ...user, id: 2147483648 })).toThrow(ApiError);
    expect(() =>
      parseLoginResponse({ ...login(), user: { ...user, emailVerified: false } }),
    ).toThrow(ApiError);
    expect(() => parseLoginResponse({ ...login(), expiresAt: 'invalid' })).toThrow(ApiError);
    expect(parseUser({ ...user, passwordHash: 'must-not-propagate' })).toEqual(user);
  });
});

describe('identity credential lifecycle', () => {
  it('keeps credentials out of reactive state and supports environments without storage', async () => {
    const request = vi.fn<ReturnType<typeof createApiClient>>().mockResolvedValue(login());
    const session = setup(request);
    await session.login({ email: user.email, password: 'secret' });
    expect(session.user.value).toEqual(user);
    expect(session).not.toHaveProperty('accessToken');
    expect(JSON.stringify(session.user.value)).not.toContain('test-secret');
    expect(setup(request).isAuthenticated()).toBe(false);
  });

  it('expires the session even without a subsequent API request', async () => {
    vi.useFakeTimers();
    const session = setup(vi.fn<ReturnType<typeof createApiClient>>().mockResolvedValue(login()));
    await session.login({ email: user.email, password: 'secret' });
    await vi.advanceTimersByTimeAsync(60_001);
    expect(session.isAuthenticated()).toBe(false);
    expect(session.user.value).toBeNull();
    expect(session.endReason.value).toBe('expired');
  });

  it('clears a revoked credential on a private 401', async () => {
    const request = vi
      .fn<ReturnType<typeof createApiClient>>()
      .mockResolvedValueOnce(login())
      .mockRejectedValueOnce(new ApiError(401, 'UNAUTHENTICATED', '', null));
    const session = setup(request);
    await session.login({ email: user.email, password: 'secret' });
    await expect(session.refreshProfile()).rejects.toMatchObject({ status: 401 });
    expect(session.isAuthenticated()).toBe(false);
    expect(session.endReason.value).toBe('revoked');
    expect(request.mock.calls[1]?.[1]?.accessToken).toBe('1.test-secret');
  });

  it('ignores an old private 401 after a newer login', async () => {
    const profile = deferred<unknown>();
    const request = vi
      .fn<ReturnType<typeof createApiClient>>()
      .mockResolvedValueOnce(login())
      .mockReturnValueOnce(profile.promise)
      .mockResolvedValueOnce(login('other@example.com', '2.new-secret'));
    const session = setup(request);
    await session.login({ email: user.email, password: 'secret' });
    const pending = session.refreshProfile().catch((error: unknown) => error);
    await session.login({ email: 'other@example.com', password: 'secret' });
    profile.reject(new ApiError(401, 'UNAUTHENTICATED', '', null));
    await pending;
    expect(session.user.value?.email).toBe('other@example.com');
    expect(session.isAuthenticated()).toBe(true);
  });

  it('does not authenticate a cancelled login or a login superseded by logout', async () => {
    const response = deferred<unknown>();
    const session = setup(
      vi.fn<ReturnType<typeof createApiClient>>().mockReturnValue(response.promise),
    );
    const controller = new AbortController();
    const pending = session.login({ email: user.email, password: 'secret' }, controller.signal);
    controller.abort();
    response.resolve(login());
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(session.isAuthenticated()).toBe(false);

    const response2 = deferred<unknown>();
    const session2 = setup(
      vi.fn<ReturnType<typeof createApiClient>>().mockReturnValue(response2.promise),
    );
    const pending2 = session2.login({ email: user.email, password: 'secret' });
    await session2.logout();
    response2.resolve(login());
    await expect(pending2).rejects.toMatchObject({ name: 'AbortError' });
    expect(session2.isAuthenticated()).toBe(false);
  });

  it.each([
    new TypeError('Network unavailable'),
    new DOMException('Timed out', 'TimeoutError'),
    new DOMException('Cancelled', 'AbortError'),
    new ApiError(500, 'INTERNAL_ERROR', '', null),
    new ApiError(502, 'HTTP_ERROR', '', null),
    new ApiError(503, 'SERVICE_UNAVAILABLE', '', null),
    new ApiError(429, 'RATE_LIMITED', '', null),
    new ApiError(403, 'FORBIDDEN', '', null),
    new ApiError(400, 'CURRENT_PASSWORD_INVALID', '', null),
  ])('keeps the session on a recoverable request failure: %s', async (failure) => {
    const request = vi
      .fn<ReturnType<typeof createApiClient>>()
      .mockResolvedValueOnce(login())
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce({ ...user, hasPassword: true });
    const session = setup(request);
    await session.login({ email: user.email, password: 'secret' });
    await expect(session.refreshProfile()).rejects.toBe(failure);
    expect(session.isAuthenticated()).toBe(true);
    expect(session.user.value).toEqual(user);
    expect(session.endReason.value).toBeNull();
    await session.refreshProfile();
    expect(session.isAuthenticated()).toBe(true);
    expect(request.mock.calls[2]?.[1]?.accessToken).toBe('1.test-secret');
  });

  it('keeps the session when a successful HTTP response contains invalid data', async () => {
    const request = vi
      .fn<ReturnType<typeof createApiClient>>()
      .mockResolvedValueOnce(login())
      .mockResolvedValueOnce('<proxy page>');
    const session = setup(request);
    await session.login({ email: user.email, password: 'secret' });
    await expect(session.refreshProfile()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    expect(session.isAuthenticated()).toBe(true);
  });

  it('only ends the session after a confirmed password change', async () => {
    const request = vi
      .fn<ReturnType<typeof createApiClient>>()
      .mockResolvedValueOnce(login())
      .mockRejectedValueOnce(new ApiError(400, 'CURRENT_PASSWORD_INVALID', '', null))
      .mockRejectedValueOnce(new TypeError('Network unavailable'))
      .mockResolvedValueOnce(undefined);
    const session = setup(request);
    await session.login({ email: user.email, password: 'secret' });
    await expect(session.changePassword('wrong', 'newpass')).rejects.toThrow();
    expect(session.isAuthenticated()).toBe(true);
    await expect(session.changePassword('secret', 'newpass')).rejects.toThrow();
    expect(session.isAuthenticated()).toBe(true);
    await session.changePassword('secret', 'newpass');
    expect(session.isAuthenticated()).toBe(false);
    expect(session.endReason.value).toBe('password-changed');
  });

  it('logs out locally on a server failure and exposes the incomplete revoke', async () => {
    const request = vi
      .fn<ReturnType<typeof createApiClient>>()
      .mockResolvedValueOnce(login())
      .mockRejectedValueOnce(new TypeError('Network unavailable'));
    const session = setup(request);
    await session.login({ email: user.email, password: 'secret' });
    await expect(session.logout()).rejects.toThrow();
    expect(session.user.value).toBeNull();
    expect(session.logoutFailed.value).toBe(true);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('ends a session if the server requires email confirmation again', async () => {
    const request = vi
      .fn<ReturnType<typeof createApiClient>>()
      .mockResolvedValueOnce(login())
      .mockRejectedValueOnce(new ApiError(403, 'EMAIL_NOT_VERIFIED', '', null));
    const session = setup(request);
    await session.login({ email: user.email, password: 'secret' });
    await expect(session.refreshProfile()).rejects.toMatchObject({ code: 'EMAIL_NOT_VERIFIED' });
    expect(session.isAuthenticated()).toBe(false);
  });

  it('clears a previous logout warning after a new sign-in', async () => {
    const request = vi
      .fn<ReturnType<typeof createApiClient>>()
      .mockResolvedValueOnce(login())
      .mockRejectedValueOnce(new TypeError('Network unavailable'))
      .mockResolvedValueOnce(login());
    const session = setup(request);
    await session.login({ email: user.email, password: 'secret' });
    await session.logout().catch(() => {});
    expect(session.logoutFailed.value).toBe(true);
    await session.login({ email: user.email, password: 'secret' });
    expect(session.logoutFailed.value).toBe(false);
  });
});

describe('localStorage session persistence', () => {
  function storageFixture() {
    const values = new Map<string, string>();
    return {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
      removeItem: (key: string) => {
        values.delete(key);
      },
    };
  }

  it('restores an unexpired credential and preserves it through backend unavailability', async () => {
    const storage = storageFixture();
    const first = createIdentitySession(
      vi.fn<ReturnType<typeof createApiClient>>().mockResolvedValue(login()),
      storage,
    );
    sessions.push(first);
    await first.login({ email: user.email, password: 'secret' });
    expect(storage.getItem('typstoria.session')).toContain('1.test-secret');
    const request = vi
      .fn<ReturnType<typeof createApiClient>>()
      .mockRejectedValue(new TypeError('Offline'));
    const restored = createIdentitySession(request, storage);
    sessions.push(restored);
    expect(restored.isAuthenticated()).toBe(true);
    expect(restored.user.value).toEqual(user);
    await expect(restored.refreshProfile()).rejects.toThrow();
    expect(storage.getItem('typstoria.session')).toContain('1.test-secret');
    expect(restored.isAuthenticated()).toBe(true);
  });

  it('discards malformed and expired saved credentials', () => {
    const storage = storageFixture();
    for (const value of [
      'broken json',
      JSON.stringify({ ...login(), expiresAt: '2020-01-01T00:00:00Z' }),
      JSON.stringify({ ...login(), accessToken: 'secret with spaces' }),
    ]) {
      storage.setItem('typstoria.session', value);
      const session = createIdentitySession(vi.fn<ReturnType<typeof createApiClient>>(), storage);
      sessions.push(session);
      expect(session.isAuthenticated()).toBe(false);
      expect(storage.getItem('typstoria.session')).toBeNull();
    }
  });

  it('synchronizes account switching and logout across tabs and ignores old pending replies', async () => {
    const storage = storageFixture();
    const events = new EventTarget();
    const pending = deferred<unknown>();
    const request = vi
      .fn<ReturnType<typeof createApiClient>>()
      .mockResolvedValueOnce(login())
      .mockReturnValueOnce(pending.promise);
    const first = createIdentitySession(request, storage, events);
    sessions.push(first);
    await first.login({ email: user.email, password: 'secret' });
    const oldReply = first.refreshProfile().catch((error: unknown) => error);
    storage.setItem(
      'typstoria.session',
      JSON.stringify(login('second@example.com', '2.other-token')),
    );
    events.dispatchEvent(Object.assign(new Event('storage'), { key: 'typstoria.session' }));
    expect(first.user.value?.email).toBe('second@example.com');
    pending.reject(new ApiError(401, 'UNAUTHENTICATED', '', null));
    await oldReply;
    expect(first.isAuthenticated()).toBe(true);
    storage.removeItem('typstoria.session');
    events.dispatchEvent(Object.assign(new Event('storage'), { key: 'typstoria.session' }));
    expect(first.isAuthenticated()).toBe(false);
    first.dispose();
  });

  it('removes storage even if explicit server logout fails', async () => {
    const storage = storageFixture();
    const request = vi
      .fn<ReturnType<typeof createApiClient>>()
      .mockResolvedValueOnce(login())
      .mockRejectedValueOnce(new TypeError('Offline'));
    const session = createIdentitySession(request, storage);
    sessions.push(session);
    await session.login({ email: user.email, password: 'secret' });
    await session.logout().catch(() => {});
    expect(storage.getItem('typstoria.session')).toBeNull();
    expect(session.isAuthenticated()).toBe(false);
  });
});
