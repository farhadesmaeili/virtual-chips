import { RoomView } from '@/presentation/components/room-view';

export default function RoomPage({ params }: { params: { id: string } }) {
  return <RoomView roomId={params.id} />;
}
