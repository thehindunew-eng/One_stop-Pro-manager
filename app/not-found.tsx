import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="app-bg grid min-h-screen place-items-center px-5">
      <div className="panel max-w-md p-6 text-center">
        <h1 className="text-[20px] font-semibold text-slate-900">Page not found</h1>
        <p className="mt-2 text-sm text-slate-500">That link does not exist. Rooms live at /room/&lt;code&gt;.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/live" className="btn-primary">Live workspace</Link>
          <Link href="/demo" className="btn-ghost">Demo room</Link>
        </div>
      </div>
    </main>
  );
}
