'use client';

import { motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getSocket } from '@/presentation/lib/socket';
import type { PublicRoomState } from '@/presentation/lib/socket-events';
import { useConnectionStore } from '@/presentation/stores/connection-store';

export function RoomView({ roomId }: { roomId: string }): React.ReactElement {
  const reduce = useReducedMotion();
  const status = useConnectionStore((s) => s.status);
  const [room, setRoom] = useState<PublicRoomState | null>(null);

  useEffect(() => {
    const socket = getSocket();
    const onState = (state: PublicRoomState): void => setRoom(state);
    socket.on('room:state', onState);

    // Ask for the current snapshot (works on first load and on reconnect).
    const resync = (): void => {
      socket.emit('room:resync', { roomId });
    };
    if (socket.connected) resync();
    socket.on('session:ready', resync);

    return () => {
      socket.off('room:state', onState);
      socket.off('session:ready', resync);
    };
  }, [roomId]);

  return (
    <main className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-2xl flex-col gap-6 p-6">
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
          className="vc-tray flex flex-col gap-5 p-6"
        >
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tightish text-vc-ink">
              {room.name}
            </h1>
            <p className="text-sm text-vc-ink-muted">
              {room.members.length} seated · {room.status}
            </p>
          </div>

          <ul className="flex flex-col gap-2">
            {room.members.map((member) => (
              <li
                key={member.seat}
                className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/15 px-4 py-3"
              >
                <span className="flex items-center gap-3">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-vc-felt-lamp font-mono text-xs font-semibold text-vc-emerald">
                    {member.seat}
                  </span>
                  <span className="font-medium text-vc-ink">
                    {member.username}
                  </span>
                  {member.isBanker && (
                    <span className="rounded-full bg-vc-gold/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-vc-gold">
                      Banker
                    </span>
                  )}
                </span>
                <span className="font-mono text-sm tabular-nums text-vc-ink">
                  {member.chips.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>

          <p className="text-xs text-vc-ink-faint">
            The full table, seats and betting controls arrive next (tasks
            4.2–4.6); animations land in Phase 5.
          </p>
        </motion.div>
      )}
    </main>
  );
}
