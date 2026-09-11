import Link from 'next/link';
import { backendHealth } from '@/lib/backend-health';
import { ScreenHeader } from '@/components/screen-header';
export const dynamic = 'force-dynamic';
export default async function Setup() {
 const health = await backendHealth();
 return <main className="page-wrap"><ScreenHeader title="Connection status." kicker="ARENA SETUP" description="A live check of this deployment’s backend connection." /><section className="panel lobby-panel"><p>Environment variables: <strong>{health.configured ? 'Present' : 'Missing'}</strong></p><p>Database: <strong>{health.status.replaceAll('_',' ')}</strong></p><p>Schema version: {health.schemaVersion ?? 'Not available'}</p>{health.status === 'migration_required' && <p>The Supabase connection responded. Apply the arena SQL migration to enable online games.</p>}<Link className="button button-primary" href="/auth">Continue to sign in</Link></section></main>;
}
