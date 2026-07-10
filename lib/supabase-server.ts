import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Server-only Supabase client using the service-role key. Bypasses RLS.
// NEVER import this from a client component or expose the key via NEXT_PUBLIC_.
// Created lazily so the module can be imported at build time without a key.

let client: SupabaseClient | null = null;

export function getSupabaseServer(): SupabaseClient {
  if (client) return client;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Supabase server client is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    );
  }
  client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
