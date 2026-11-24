export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId: string | null,
    readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  multipart?: FormData;
  responseType?: 'blob';
  accessToken?: string;
  idempotencyKey?: string;
  templateShareToken?: string;
  signal?: AbortSignal;
  query?: Readonly<Record<string, string | number>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function createApiClient(baseUrl: string, transport: typeof fetch = fetch) {
  if (!/^\/api\/?$/.test(baseUrl)) {
    throw new Error('Use the same-origin /api endpoint. Configure the proxy for other hosts.');
  }

  // Return unknown intentionally: each module must validate its response contract.
  return async function request(path: string, options: RequestOptions = {}): Promise<unknown> {
    if (!/^\/[a-zA-Z0-9][a-zA-Z0-9/_-]*$/.test(path)) {
      throw new Error('Use a relative API path without query strings or fragments.');
    }
    if (options.multipart && options.body !== undefined) throw new Error('Choose one request body');
    const headers = new Headers({
      Accept: options.responseType === 'blob' ? 'application/octet-stream' : 'application/json',
    });
    if (options.body !== undefined) headers.set('Content-Type', 'application/json');
    if (options.accessToken) headers.set('Authorization', `Bearer ${options.accessToken}`);
    if (options.templateShareToken) headers.set('X-Template-Share', options.templateShareToken);
    if (options.idempotencyKey) headers.set('Idempotency-Key', options.idempotencyKey);

    const timeout = AbortSignal.timeout(
      options.multipart || options.responseType === 'blob' ? 120_000 : 15_000,
    );
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(options.query ?? {})) query.set(key, String(value));
    const search = query.size ? `?${query}` : '';
    const response = await transport(`${baseUrl.replace(/\/$/, '')}${path}${search}`, {
      method: options.method ?? 'GET',
      headers,
      ...(options.multipart
        ? { body: options.multipart }
        : options.body !== undefined
          ? { body: JSON.stringify(options.body) }
          : {}),
      signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
    });

    if (response.status === 204) return undefined;
    if (response.ok && options.responseType === 'blob') return response.blob();
    const data: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const error = isRecord(data) && isRecord(data.error) ? data.error : undefined;
      throw new ApiError(
        response.status,
        typeof error?.code === 'string' ? error.code : 'HTTP_ERROR',
        typeof error?.message === 'string' ? error.message : 'Не вдалося виконати запит.',
        typeof error?.requestId === 'string'
          ? error.requestId
          : response.headers.get('X-Request-Id'),
        isRecord(error?.details) ? error.details : undefined,
      );
    }
    if (data === undefined) {
      throw new ApiError(
        response.status,
        'INVALID_RESPONSE',
        'Некоректна відповідь сервера.',
        null,
      );
    }
    return data;
  };
}
