import { createClient } from '@supabase/supabase-js';
export async function backendHealth() {
 const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if (!url || !key) return { configured: false, database: false, status: 'variables_missing', schemaVersion: null };
  try {
    const client = createClient(url, key, { auth: { persistSession: false }, global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(5000) }) } });
    const { data, error } = await client.rpc('arena', { action: 'health', input: {} });
    const schemaVersion = data?.schemaVersion ?? null;
    const migrationRequired = !error && schemaVersion !== 2;
    return { configured: true, database: !error && !migrationRequired, schemaVersion, status: error ? (error.code === 'PGRST202' ? 'migration_required' : 'connection_failed') : migrationRequired ? 'migration_required' : 'ready' };
  } catch { return { configured: true, database: false, status: 'connection_failed', schemaVersion: null }; }
}
