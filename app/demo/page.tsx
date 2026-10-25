import { redirect } from 'next/navigation';
import { ROOM_CODES } from '@/lib/defaults';

export const dynamic = 'force-dynamic';

export default function DemoRoomShortcut() {
  redirect(`/room/${ROOM_CODES.demo}`);
}
