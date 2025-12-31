export type ApiError = { detail?: string };

const browserBase = process.env.NEXT_PUBLIC_API_BASE ?? "/api";
const serverBase = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";
const defaultTimeoutMs = 15000;
const retryDelayMs = 300;

const resolveBase = () => (typeof window === "undefined" ? serverBase : browserBase);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs: number): Promise<Response> => {
  if (options.signal) {
    return fetch(url, options);
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<{ data: T | null; error: ApiError | null; response: Response }> {
  const base = resolveBase();
  const { headers, ...rest } = options;
  const mergedHeaders = {
    "Content-Type": "application/json",
    ...(headers ?? {}),
  };
  const method = (rest.method ?? "GET").toUpperCase();
  const shouldRetry = method === "GET" || method === "HEAD";
  const maxAttempts = shouldRetry ? 2 : 1;
  const doFetch = async () =>
    fetchWithTimeout(
      `${base}${path}`,
      {
        credentials: "include",
        headers: mergedHeaders,
        ...rest,
      },
      defaultTimeoutMs,
    );
  let response: Response;
  try {
    let lastError: unknown;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        response = await doFetch();
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts - 1) {
          await sleep(retryDelayMs);
        }
      }
    }
    if (lastError) {
      throw lastError;
    }
  } catch (error) {
    const detail =
      error instanceof DOMException && error.name === "AbortError"
        ? "Request timeout"
        : error instanceof Error
          ? error.message
          : "Network error";
    return {
      data: null,
      error: {
        detail,
      },
      response: new Response(null, { status: 0, statusText: detail }),
    };
  }

  let data: T | null = null;
  let error: ApiError | null = null;
  const readBody = async (target: Response) => {
    const text = await target.text();
    if (!text) return { data: null, error: null };
    try {
      return target.ok
        ? { data: JSON.parse(text) as T, error: null }
        : { data: null, error: JSON.parse(text) as ApiError };
    } catch {
      return target.ok ? { data: null, error: null } : { data: null, error: { detail: text } };
    }
  };
  if (response.status === 401 && !path.startsWith("/auth/") && !path.startsWith("/install/")) {
    try {
      const refreshResponse = await fetch(`${base}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: mergedHeaders,
      });
      if (refreshResponse.ok) {
        response = await doFetch();
      }
    } catch {
      // ignore refresh failures, fall through to original response parsing
    }
  }

  ({ data, error } = await readBody(response));

  return { data, error, response };
}
