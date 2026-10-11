import { supabase } from "../lib/supabase";
export const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown,
    public status?: number,
  ) {
    super(message);
  }
}
export interface ApiOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}
export async function api<T>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  if (!supabase)
    throw new ApiError(
      "Configure the Supabase project URL and public key.",
      "NOT_CONFIGURED",
    );
  const { data } = await supabase.auth.getSession();
  if (!data.session)
    throw new ApiError("Sign in to continue.", "UNAUTHORIZED", undefined, 401);
  const url = `${import.meta.env.VITE_API_URL ?? ""}/api${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      signal: options.signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw e;
    throw new ApiError(
      "Cannot reach the API. Make sure the backend is running.",
      "NETWORK_ERROR",
    );
  }
  if (response.status === 204) return undefined as T;
  const json = await response
    .json()
    .catch(() => ({
      error: {
        message: "The API returned an invalid response.",
        code: "INVALID_RESPONSE",
      },
    }));
  if (!response.ok) {
    if (response.status === 401)
      await supabase.auth.signOut({ scope: "local" });
    throw new ApiError(
      json.error?.message ?? "Request failed.",
      json.error?.code ?? "API_ERROR",
      json.error?.details,
      response.status,
    );
  }
  return json as T;
}
export function withTimezone(path: string) {
  return `${path}${path.includes("?") ? "&" : "?"}timezone=${encodeURIComponent(timezone)}`;
}
