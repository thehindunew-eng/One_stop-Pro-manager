import JoinForm from '@/components/JoinForm';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default function JoinPage({
  searchParams,
}: {
  searchParams: { code?: string; create?: string };
}) {
  const code = (searchParams.code || process.env.DEMO_PROJECT_CODE || 'studio').toLowerCase();
  return <JoinForm defaultCode={code} defaultCreate={searchParams.create === '1'} />;
}
