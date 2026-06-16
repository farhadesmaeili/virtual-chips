'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { friendlyError } from '@/presentation/lib/error-messages';
import { getSocket } from '@/presentation/lib/socket';
import type {
  PublicRoomState,
  SocketError,
} from '@/presentation/lib/socket-events';
import { useConnectionStore } from '@/presentation/stores/connection-store';

type RoomEvent =
  | { type: 'room:create'; payload: { name: string } }
  | { type: 'room:join'; payload: { roomId: string } };

const fieldClass =
  'rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-vc-ink placeholder:text-vc-ink-faint outline-none transition focus:border-vc-emerald/60 focus:bg-black/30';

export function Lobby(): React.ReactElement {
  const reduce = useReducedMotion();
  const router = useRouter();
  const { data: session } = useSession();
  const status = useConnectionStore((s) => s.status);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const connected = status === 'connected';

  function run(event: RoomEvent): void {
    if (!connected || busy) return;
    setBusy(true);
    setError(null);

    const socket = getSocket();
    const cleanup = (): void => {
      socket.off('room:state', onState);
      socket.off('error', onError);
    };
    const onState = (room: PublicRoomState): void => {
      cleanup();
      router.push(`/room/${room.id}`);
    };
    const onError = (err: SocketError): void => {
      cleanup();
      setBusy(false);
      setError(friendlyError(err.code, err.message));
    };

    socket.on('room:state', onState);
    socket.on('error', onError);
    socket.emit(event.type, event.payload);
  }

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="flex w-full flex-col gap-5"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm text-vc-ink-muted">
          At the table as{' '}
          <span className="font-medium text-vc-ink">
            {session?.user?.username ?? session?.user?.email ?? 'player'}
          </span>
        </p>
        <button
          onClick={() => void signOut()}
          className="text-xs text-vc-ink-faint underline-offset-2 transition hover:text-vc-ink-muted hover:underline"
        >
          Leave
        </button>
      </div>

      {!connected && (
        <p className="rounded-xl border border-vc-gold/25 bg-vc-gold/10 px-4 py-2.5 text-sm text-vc-gold">
          Connecting to the table server…
        </p>
      )}

      {error !== null && (
        <p className="rounded-xl border border-vc-danger/30 bg-vc-danger/10 px-4 py-2.5 text-sm text-vc-danger">
          {error}
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-vc-emerald/90">
          Open a table
        </h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Friday night game"
          maxLength={60}
          className={fieldClass}
        />
        <button
          onClick={() => run({ type: 'room:create', payload: { name } })}
          disabled={!connected || busy || name.trim().length === 0}
          className="rounded-xl bg-vc-emerald px-4 py-3 font-semibold text-vc-felt-edge shadow-[0_8px_20px_-6px_rgb(52_211_153/0.5)] transition hover:bg-vc-emerald/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Deal me in
        </button>
      </section>

      <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-vc-ink-faint">
        <span className="h-px flex-1 bg-white/10" />
        or
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-vc-ink-muted">
          Join a table
        </h2>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Table code"
          className={`${fieldClass} font-mono`}
        />
        <button
          onClick={() =>
            run({ type: 'room:join', payload: { roomId: code.trim() } })
          }
          disabled={!connected || busy || code.trim().length === 0}
          className="rounded-xl border border-vc-rail-edge/60 bg-white/[0.04] px-4 py-3 font-semibold text-vc-ink transition hover:bg-white/[0.08] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Take a seat
        </button>
      </section>
    </motion.div>
  );
}
