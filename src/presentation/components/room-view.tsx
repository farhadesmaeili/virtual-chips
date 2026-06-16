'use client';

import { motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PokerTable } from './poker-table';
import { getSocket } from '@/presentation/lib/socket';
import type {
  PublicHandState,
  PublicRoomState,
} from '@/presentation/lib/socket-events';
import { useConnectionStore } from '@/presentation/stores/connection-store';

export function RoomView({ roomId }: { roomId: string }): React.ReactElement {
  const reduce = useReducedMotion();
  const status = useConnectionStore((s) => s.status);
  const [room, setRoom] = useState<PublicRoomState | null>(null);
  const [hand, setHand] = useState<PublicHandState | null>(null);

  useEffect(() => {
    const socket = getSocket();
    const onState = (state: PublicRoomState): void => setRoom(state);
    const onHand = (state: PublicHandState): void => setHand(state);
    socket.on('room:state', onState);
    socket.on('hand:state', onHand);

    // Ask for the current snapshot (works on first load and on reconnect).
    const resync = (): void => {
      socket.emit('room:resync', { roomId });
    };
    if (socket.connected) resync();
    socket.on('session:ready', resync);

    return () => {
      socket.off('room:state', onState);
      socket.off('hand:state', onHand);
      socket.off('session:ready', resync);
    };
  }, [roomId]);

  return (
    <main className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-4xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="text-sm text-vc-ink-muted transition hover:text-vc-ink"
        >
          ← Lobby
        </Link>
        <span className="font-mono text-xs text-vc-ink-faint">{roomId}</span>
      </div>

      {room === null ? (
        <p className="text-vc-ink-muted">
          {status === 'connected'
            ? 'Reading the table…'
            : 'Connecting to the table server…'}
        </p>
      ) : (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="flex flex-col gap-4"
        >
          <div className="text-center">
            <h1 className="font-display text-2xl font-bold tracking-tightish text-vc-ink">
              {room.name}
            </h1>
            <p className="text-sm text-vc-ink-muted">
              {room.members.length} seated · {room.status}
            </p>
          </div>

          <PokerTable room={room} hand={hand} />

          <p className="text-center text-xs text-vc-ink-faint">
            Betting controls and the banker view arrive next (tasks 4.3–4.6);
            chip and turn animations land in Phase 5.
          </p>
        </motion.div>
      )}
    </main>
  );
}
