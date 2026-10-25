import { createBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof createBrowserClient> | null = null;

/** Same cookie name in the browser and on the server, whatever URL Supabase is reached through. */
export const AUTH_COOKIE = "sb-pawfolio-auth";

/**
 * Supabase URL for the browser. With NEXT_PUBLIC_SUPABASE_VIA_APP=1 (local phone testing),
 * Supabase is reached through the app itself at /sb, so one public address is enough.
 */
function browserUrl() {
  if (process.env.NEXT_PUBLIC_SUPABASE_VIA_APP === "1" && typeof location !== "undefined") return `${location.origin}/sb`;
  return process.env.NEXT_PUBLIC_SUPABASE_URL!;
}

/** Supabase client for the browser. All data access goes through it; RLS in the DB decides what is visible. */
export function supabase() {
  if (!client) {
    client = createBrowserClient(browserUrl(), process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      cookieOptions: { name: AUTH_COOKIE },
    });
  }
  return client;
}
