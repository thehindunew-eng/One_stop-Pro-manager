import JoinForm from '@/components/JoinForm';
import { ROOM_CODES } from '@/lib/defaults';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default function JoinPage({
  searchParams,
}: {
  searchParams: { code?: string; create?: string };
}) {
  const code = (searchParams.code || ROOM_CODES.live).toLowerCase();
  return (
    <JoinForm
      defaultCode={code}
      defaultCreate={searchParams.create === '1'}
      liveCode={ROOM_CODES.live}
      demoCode={ROOM_CODES.demo}
    />
  );
}
