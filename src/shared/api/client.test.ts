import { describe, expect, it, vi } from 'vitest';
import { createApiClient } from './client';

describe('API transport boundary', () => {
  it('sends Bearer explicitly and handles an empty logout response', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const request = createApiClient('/api', transport);
    await expect(
      request('/auth/logout', { method: 'POST', accessToken: 'test-token' }),
    ).resolves.toBeUndefined();
    const [url, init] = transport.mock.calls[0]!;
    expect(url).toBe('/api/auth/logout');
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer test-token');
    expect(init?.credentials).toBe('omit');
    expect(init?.redirect).toBe('error');
  });

  it('keeps conflict codes and request IDs without retrying a mutation', async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json(
          { error: { code: 'REVISION_CONFLICT', message: 'Conflict', requestId: 'req-1' } },
          { status: 409 },
        ),
      );
    await expect(
      createApiClient('/api', transport)('/projects/1/changes', {
        method: 'POST',
        body: { baseRevisionId: 1 },
      }),
    ).rejects.toMatchObject({
      status: 409,
      code: 'REVISION_CONFLICT',
      requestId: 'req-1',
    });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('handles a proxy HTML error without exposing its body', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('<html>proxy failure</html>', {
        status: 502,
        headers: { 'X-Request-Id': 'proxy-1' },
      }),
    );
    await expect(createApiClient('/api', transport)('/auth/me')).rejects.toMatchObject({
      status: 502,
      code: 'HTTP_ERROR',
      requestId: 'proxy-1',
    });
  });

  it('rejects external and traversal paths before sending credentials', async () => {
    const transport = vi.fn<typeof fetch>();
    const request = createApiClient('/api', transport);
    const invalidPaths = [
      'https://example.com',
      '//example.com',
      '/../auth/me',
      '/auth/me#token=x',
    ];
    for (const path of invalidPaths) {
      await expect(request(path, { accessToken: 'secret' })).rejects.toThrow();
    }
    expect(transport).not.toHaveBeenCalled();
    expect(() => createApiClient('https://example.com/api', transport)).toThrow();
  });
});
