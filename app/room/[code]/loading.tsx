export default function RoomLoading() {
  return (
    <main className="app-bg grid min-h-screen place-items-center px-5">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-pulse rounded-lg bg-slate-900/10" />
        <div className="text-[13px] font-medium text-slate-900">Opening the room…</div>
        <div className="mt-1 text-[12px] text-slate-500">Loading the conversation, signals and artifacts.</div>
        <div className="mx-auto mt-4 h-1 w-40 overflow-hidden rounded-full bg-slate-900/10">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-electric/70" />
        </div>
      </div>
    </main>
  );
}
