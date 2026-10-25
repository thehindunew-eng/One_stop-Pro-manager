import Link from 'next/link';
import { currentUser, userFromToken } from '@/lib/auth';
import { DEMO_CODE, PROD_CODE, ensureBase, findProject, getWorkspace } from '@/lib/repo';
import Workspace from '@/components/Workspace';
import RoomGate from '@/components/RoomGate';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function RoomPage({
  params,
  searchParams,
}: {
  params: { code: string };
  searchParams: { k?: string };
}) {
  await ensureBase();

  // Session comes from the cookie when available, otherwise from the signed
  // token in ?k= — so the room opens even where cookies are blocked.
  const user = (await currentUser()) ?? (await userFromToken(searchParams.k));
  const project = await findProject(params.code);

  if (!user) {
    if (!project) return <MissingRoom code={params.code} />;
    const members = await import('@/lib/repo').then((m) => m.listMembers(project.id));
    return (
      <RoomGate
        code={project.code}
        roomName={project.name}
        tagline={project.tagline}
        members={members.length}
        demoCode={DEMO_CODE}
      />
    );
  }

  const state = await getWorkspace(params.code, user);
  if (!state) return <MissingRoom code={params.code} />;

  return (
    <Workspace
      initialState={state}
      token={searchParams.k ?? null}
      siblings={{ demo: DEMO_CODE, live: PROD_CODE }}
    />
  );
}

function MissingRoom({ code }: { code: string }) {
  return (
    <main className="app-bg grid min-h-screen place-items-center px-5">
      <div className="panel max-w-md p-6 text-center">
        <h1 className="text-lg font-semibold text-slate-900">That room does not exist</h1>
        <p className="mt-2 text-sm text-slate-500">
          <span className="font-mono text-slate-400">/{code}</span> is not a room link. Ask the owner for the current
          link, or open an existing room.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href={`/room/${PROD_CODE}`} className="btn-primary">Live workspace</Link>
          <Link href={`/room/${DEMO_CODE}`} className="btn-ghost">Demo room</Link>
          <Link href="/join?create=1" className="btn-subtle">Create a room</Link>
        </div>
      </div>
    </main>
  );
}
