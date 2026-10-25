'use client';

import Link from 'next/link';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="app-bg grid min-h-screen place-items-center px-5">
      <div className="panel max-w-lg p-6 text-center">
        <h1 className="text-[20px] font-semibold text-slate-900">Something broke while loading</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
          The room hit an unexpected error. Your data is safe in Postgres — retry, or open another room.
        </p>
        {error?.message && (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-left font-mono text-[12px] text-rose">
            {error.message}
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button type="button" className="btn-primary" onClick={reset}>Try again</button>
          <Link href="/live" className="btn-ghost">Live workspace</Link>
          <Link href="/" className="btn-subtle">Home</Link>
        </div>
      </div>
    </main>
  );
}
