import { ApiError, createApiClient } from '../../shared/api/client';
import type { components } from '../../shared/api/schema';

export type User = components['schemas']['UserDto'];
export type LoginResponse = components['schemas']['LoginResponseDto'];
export type Credentials = components['schemas']['CredentialsDto'];
type Request = ReturnType<typeof createApiClient>;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function invalidResponse(): never {
  throw new ApiError(200, 'INVALID_RESPONSE', 'Некоректна відповідь сервера.', null);
}

export function parseUser(value: unknown): User {
  if (
    !record(value) ||
    !Number.isInteger(value.id) ||
    typeof value.id !== 'number' ||
    value.id < 1 ||
    value.id > 2147483647 ||
    typeof value.email !== 'string' ||
    typeof value.emailVerified !== 'boolean' ||
    typeof value.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(value.createdAt))
  )
    invalidResponse();
  return {
    id: value.id,
    email: value.email,
    emailVerified: value.emailVerified,
    createdAt: value.createdAt,
  };
}

export function parseLoginResponse(value: unknown): LoginResponse {
  if (
    !record(value) ||
    typeof value.accessToken !== 'string' ||
    !value.accessToken ||
    value.tokenType !== 'Bearer' ||
    typeof value.expiresAt !== 'string' ||
    !Number.isFinite(Date.parse(value.expiresAt))
  )
    invalidResponse();
  const user = parseUser(value.user);
  if (!user.emailVerified) invalidResponse();
  return { accessToken: value.accessToken, tokenType: 'Bearer', expiresAt: value.expiresAt, user };
}

export function parseMessage(value: unknown): void {
  if (!record(value) || typeof value.message !== 'string') invalidResponse();
}

export function createIdentityApi(request: Request = createApiClient('/api')) {
  async function message(path: string, body: unknown, signal?: AbortSignal) {
    parseMessage(await request(path, { method: 'POST', body, ...(signal ? { signal } : {}) }));
  }
  return {
    async login(credentials: Credentials, signal?: AbortSignal) {
      return parseLoginResponse(
        await request('/auth/login', {
          method: 'POST',
          body: credentials,
          ...(signal ? { signal } : {}),
        }),
      );
    },
    async google(idToken: string, signal?: AbortSignal) {
      return parseLoginResponse(
        await request('/auth/google', {
          method: 'POST',
          body: { idToken },
          ...(signal ? { signal } : {}),
        }),
      );
    },
    register: (credentials: Credentials, signal?: AbortSignal) =>
      message('/auth/register', credentials, signal),
    resend: (email: string, signal?: AbortSignal) =>
      message('/auth/resend-verification', { email }, signal),
    forgot: (email: string, signal?: AbortSignal) =>
      message('/auth/forgot-password', { email }, signal),
    verify: (token: string, signal?: AbortSignal) =>
      message('/auth/verify-email', { token }, signal),
    reset: (token: string, password: string, signal?: AbortSignal) =>
      message('/auth/reset-password', { token, password }, signal),
  };
}

export type IdentityApi = ReturnType<typeof createIdentityApi>;
