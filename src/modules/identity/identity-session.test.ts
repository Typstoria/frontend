import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from '../../shared/api/client';
import { parseLoginResponse, parseUser } from './identity-api';
import { createIdentitySession } from './identity-session';

const user = {
  id: 1,
  email: 'writer@example.com',
  emailVerified: true,
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

describe('memory-only identity session', () => {
  it('keeps credentials out of exposed state and does not restore a new instance', async () => {
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
