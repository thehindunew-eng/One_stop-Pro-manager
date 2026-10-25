import { redirect } from 'next/navigation';
import { currentUser, userFromToken } from '@/lib/auth';
import { ensureBase, getWorkspace } from '@/lib/repo';
import AdminConsole from '@/components/AdminConsole';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function AdminPage({
  params,
  searchParams,
}: {
  params: { code: string };
  searchParams: { k?: string };
}) {
  await ensureBase();
  const user = (await currentUser()) ?? (await userFromToken(searchParams.k));
  if (!user) redirect(`/room/${encodeURIComponent(params.code)}`);
  const state = await getWorkspace(params.code, user);
  if (!state) redirect(`/room/${params.code}`);
  if (!state.me.canAdmin) redirect(`/room/${params.code}`);
  return <AdminConsole initialState={state} token={searchParams.k ?? null} />;
}
