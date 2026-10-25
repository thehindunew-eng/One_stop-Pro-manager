import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { ensureBase, getWorkspace } from '@/lib/repo';
import AdminConsole from '@/components/AdminConsole';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function AdminPage({ params }: { params: { code: string } }) {
  await ensureBase();
  const user = await currentUser();
  if (!user) redirect(`/join?code=${encodeURIComponent(params.code)}`);
  const state = await getWorkspace(params.code, user);
  if (!state) redirect('/join');
  if (!state.me.canAdmin) redirect(`/room/${params.code}`);
  return <AdminConsole initialState={state} />;
}
