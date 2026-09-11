import Link from 'next/link';
export function ArenaFeedback({ error, loading }: { error: string; loading?: boolean }) {
 return <>{loading && <p role="status">Connecting to your table…</p>}{error && <div className="alert" role="alert">{error} {error.toLowerCase().includes('sign in') && <Link className="text-link" href="/auth">Sign in →</Link>}</div>}</>;
}
