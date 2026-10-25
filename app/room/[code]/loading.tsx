export default function RoomLoading() {
  return (
    <main className="app-bg grid min-h-screen place-items-center px-5">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin-slow rounded-2xl bg-gradient-to-br from-electric to-cyan" />
        <div className="text-[13px] font-medium text-slate-900">Opening the room…</div>
        <div className="mt-1 text-[11.5px] text-slate-500">Loading the conversation, signals and artifacts.</div>
        <div className="mx-auto mt-4 h-1 w-40 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-electric/70" />
        </div>
      </div>
    </main>
  );
}
