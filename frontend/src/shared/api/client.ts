const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

interface ApiFetchOptions {
  method?: HttpMethod;
  body?: unknown;
}

interface ApiErrorPayload {
  statusCode: number;
  message: string | string[];
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly payload: ApiErrorPayload,
  ) {
    const msg = payload.message;
    super(Array.isArray(msg) ? msg[0] : msg);
  }
}

export async function apiFetch<T = void>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { method = 'GET', body } = options;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const payload: ApiErrorPayload = await res
      .json()
      .catch(() => ({ statusCode: res.status, message: res.statusText }));
    throw new ApiError(res.status, payload);
  }

  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}
