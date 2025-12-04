"use client";

import { Room } from "@/app/components/Room";

export default function RoomPage({ params }: { params: { roomId: string } }) {
  return <Room initialRoomId={params.roomId} />;
}
