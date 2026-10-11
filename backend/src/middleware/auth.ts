import { createClient } from "@supabase/supabase-js";
import { AppError } from "../utils/errors.js";
import type { Env } from "../config/env.js";
export type VerifyToken = (token: string) => Promise<string>;
export function supabaseVerifier(env: Env): VerifyToken {
  const auth = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLIC_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).auth;
  return async (token) => {
    try {
      const { data, error } = await auth.getUser(token);
      if (error || !data.user) throw new Error("invalid");
      return data.user.id;
    } catch {
      throw new AppError(
        401,
        "UNAUTHORIZED",
        "Your session expired or is invalid. Sign in again.",
      );
    }
  };
}
