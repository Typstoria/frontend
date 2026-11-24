import { ApiError } from '../../shared/api/client';
import type { RequestOptions } from '../../shared/api/client';
import type { components } from '../../shared/api/schema';
import { validId } from '../workspace/workspace-api';

export type OAuthConnection = components['schemas']['AccessGrantDto'];
export type OAuthScope = OAuthConnection['scopes'][number];
type OAuthAvailability = components['schemas']['OAuthAvailabilityDto'];
type Request = (path: string, options?: Omit<RequestOptions, 'accessToken'>) => Promise<unknown>;

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;
const scopes: OAuthScope[] = [
  'projects:read',
  'documents:read',
  'context:read',
  'annotations:read',
  'history:read',
  'changes:read',
  'changes:propose',
  'uploads:stage',
  'compile:run',
  'compile:read',
];

function invalid(): never {
  throw new ApiError(200, 'INVALID_RESPONSE', 'Некоректна відповідь сервера.', null);
}

function parseConnection(value: unknown): OAuthConnection {
  if (
    !record(value) ||
    !validId(value.id) ||
    typeof value.name !== 'string' ||
    !value.name.trim() ||
    !Array.isArray(value.scopes) ||
    value.scopes.length === 0 ||
    value.scopes.some((scope) => !scopes.includes(scope as OAuthScope)) ||
    !Array.isArray(value.projectIds) ||
    value.projectIds.length === 0 ||
    value.projectIds.some((id) => !validId(id)) ||
    !Array.isArray(value.projects) ||
    !(value.clientId === null || typeof value.clientId === 'string') ||
    !['active', 'expired', 'revoked'].includes(String(value.status)) ||
    typeof value.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(value.createdAt)) ||
    typeof value.expiresAt !== 'string' ||
    !Number.isFinite(Date.parse(value.expiresAt)) ||
    !(
      value.revokedAt === null ||
      (typeof value.revokedAt === 'string' && Number.isFinite(Date.parse(value.revokedAt)))
    )
  )
    invalid();
  const projectIds = new Set(value.projectIds);
  for (const project of value.projects) {
    if (
      !record(project) ||
      !validId(project.id) ||
      !projectIds.delete(project.id) ||
      typeof project.title !== 'string' ||
      !project.title.trim()
    )
      invalid();
  }
  return value as OAuthConnection;
}

export function createOAuthConnectionsApi(request: Request) {
  return {
    async availability(signal: AbortSignal): Promise<OAuthAvailability> {
      const value = await request('/access/oauth', { signal }).catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 404) return { enabled: false, url: null };
        throw error;
      });
      if (
        !record(value) ||
        typeof value.enabled !== 'boolean' ||
        !(value.url === null || typeof value.url === 'string')
      )
        invalid();
      if (!value.enabled) {
        if (value.url !== null) invalid();
        return { enabled: false, url: null };
      }
      if (!value.url) invalid();
      let url: URL;
      try {
        url = new URL(value.url);
      } catch {
        return invalid();
      }
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        url.pathname !== '/mcp'
      )
        invalid();
      return { enabled: true, url: url.toString() };
    },
    async list(cursor: number | undefined, signal: AbortSignal) {
      const value = await request('/access/connections', {
        query: { limit: 20, ...(cursor === undefined ? {} : { cursor }) },
        signal,
      });
      if (
        !record(value) ||
        !Array.isArray(value.items) ||
        !(value.nextCursor === null || validId(value.nextCursor))
      )
        invalid();
      const items = value.items.map(parseConnection);
      if (new Set(items.map(({ id }) => id)).size !== items.length) invalid();
      return { items, nextCursor: value.nextCursor as number | null };
    },
    async revoke(id: number, signal: AbortSignal): Promise<void> {
      if (!validId(id)) throw new Error('Invalid connection ID');
      await request(`/access/connections/${id}`, { method: 'DELETE', signal });
    },
  };
}
