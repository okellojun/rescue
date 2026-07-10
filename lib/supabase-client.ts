import { createClient } from '@supabase/supabase-js';

// Browser-side Supabase client. Uses the anon key and is governed by RLS.
// Safe to import in client components.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loudly in dev if env is missing; in production the build still runs
  // but runtime calls will throw, which is the correct behavior.
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      '[supabase-client] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  }
}

export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});
