export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function buildUrl(
  path: string,
  params?: Record<string, string | number | boolean | undefined | null>,
): string {
  if (!params) return path

  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    searchParams.set(key, String(value))
  }

  const qs = searchParams.toString()
  return qs ? `${path}?${qs}` : path
}

export interface FetchApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  formData?: FormData
  errorMessage?: string
  signal?: AbortSignal
}

export async function fetchApi<T>(path: string, options?: FetchApiOptions): Promise<T> {
  const response = await fetchApiRaw(path, options)

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      typeof payload?.error === 'string'
        ? payload.error
        : (options?.errorMessage ?? 'Request failed.')
    throw new ApiError(message, response.status)
  }

  return payload as T
}

export async function fetchApiRaw(path: string, options?: FetchApiOptions): Promise<Response> {
  const { method, body, formData, signal } = options ?? {}
  const isGet = !method || method === 'GET'

  const headers: Record<string, string> = {}
  let requestBody: BodyInit | undefined

  if (formData) {
    requestBody = formData
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    requestBody = JSON.stringify(body)
  }

  return fetch(path, {
    method: method ?? 'GET',
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    body: requestBody,
    signal,
    ...(isGet ? { cache: 'no-store' as RequestCache } : {}),
  })
}
