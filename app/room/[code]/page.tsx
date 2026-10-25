import { redirect } from 'next/navigation';
import Link from 'next/link';
import { currentUser } from '@/lib/auth';
import { ensureBase, getWorkspace } from '@/lib/repo';
import Workspace from '@/components/Workspace';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function RoomPage({ params }: { params: { code: string } }) {
  await ensureBase();
  const user = await currentUser();
  if (!user) redirect(`/join?code=${encodeURIComponent(params.code)}`);

  const state = await getWorkspace(params.code, user);
  if (!state) {
    return (
      <main className="app-bg grid min-h-screen place-items-center px-5">
        <div className="panel max-w-md p-6 text-center">
          <h1 className="text-lg font-semibold text-white">That room does not exist</h1>
          <p className="mt-2 text-sm text-slate-400">
            The link may be out of date. Ask the owner for the current room link, or create your own room.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Link href="/join" className="btn-primary">Create a room</Link>
            <Link href="/" className="btn-ghost">Home</Link>
          </div>
        </div>
      </main>
    );
  }

  return <Workspace initialState={state} />;
}
