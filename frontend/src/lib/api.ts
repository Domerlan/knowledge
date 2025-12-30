export type ApiError = { detail?: string };

const browserBase = process.env.NEXT_PUBLIC_API_BASE ?? "/api";
const serverBase = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

const resolveBase = () => (typeof window === "undefined" ? serverBase : browserBase);

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
  const doFetch = async () =>
    fetch(`${base}${path}`, {
      credentials: "include",
      headers: mergedHeaders,
      ...rest,
    });
  let response: Response;
  try {
    response = await doFetch();
  } catch (error) {
    return {
      data: null,
      error: {
        detail: error instanceof Error ? error.message : "Network error",
      },
      response: new Response(null, { status: 0, statusText: "Network error" }),
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
