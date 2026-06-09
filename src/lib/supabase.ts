// src/lib/supabase.ts
// Lazy-initialised Supabase client — only instantiated when a shared game flow
// (share or join) is triggered.  If the env vars are missing the app still runs
// in local-only mode instead of crashing at startup.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/** Whether the build was configured with Supabase credentials. */
export function isSupabaseConfigured(): boolean {
  return !!(
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  );
}

/**
 * Returns the singleton Supabase client, creating it on first call.
 * Throws a descriptive error if the env vars are missing — callers
 * should gate on `isSupabaseConfigured()` before calling this.
 */
export function getSupabase(): SupabaseClient {
  if (client) return client;

  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to enable shared games."
    );
  }

  client = createClient(url, key);
  return client;
}