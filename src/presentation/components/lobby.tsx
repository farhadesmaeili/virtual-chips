'use client';

import { motion } from 'framer-motion';
import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useReducedMotionPreference } from '@/presentation/animations';
import { friendlyError } from '@/presentation/lib/error-messages';
import { getSocket } from '@/presentation/lib/socket';
import type {
  PublicRoomState,
  PublicUserRoom,
  RoomsMine,
  SettlementMode,
  SocketError,
} from '@/presentation/lib/socket-events';
import { useConnectionStore } from '@/presentation/stores/connection-store';

type RoomEvent =
  | {
      type: 'room:create';
      payload: {
        name: string;
        settings: {
          smallBlind: number;
          bigBlind: number;
          settlementMode: SettlementMode;
        };
      };
    }
  | { type: 'room:join'; payload: { roomId: string } };

const fieldClass =
  'rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-vc-ink placeholder:text-vc-ink-faint outline-none transition focus:border-vc-emerald/60 focus:bg-black/30';

export function Lobby(): React.ReactElement {
  const reduce = useReducedMotionPreference();
  const router = useRouter();
  const { data: session } = useSession();
  const status = useConnectionStore((s) => s.status);
  const [name, setName] = useState('');
  const [smallBlind, setSmallBlind] = useState('1');
  const [bigBlind, setBigBlind] = useState('2');
  // How pots are awarded (task 6.1). Default 'banker' matches the server default,
  // so existing behavior is unchanged unless the creator opts into 'showdown'.
  const [settlementMode, setSettlementMode] =
    useState<SettlementMode>('banker');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [myRooms, setMyRooms] = useState<readonly PublicUserRoom[]>([]);

  const connected = status === 'connected';

  // One-time fetch of the rooms this user belongs to, for the "Your table" card
  // (task 4.13). The lobby re-mounts on the normal way back (e.g. after leaving
  // a table), so this re-runs and stays fresh without a live subscription.
  useEffect(() => {
    const socket = getSocket();
    const onRooms = (data: RoomsMine): void => setMyRooms(data.rooms);
    const fetchMine = (): void => {
      socket.emit('rooms:mine');
    };
    socket.on('rooms:mine', onRooms);
    socket.on('session:ready', fetchMine);
    if (socket.connected) fetchMine();
    return () => {
      socket.off('rooms:mine', onRooms);
      socket.off('session:ready', fetchMine);
    };
  }, []);

  // The lobby assumes a single active table for now (task 4.13).
  const activeTable = myRooms[0] ?? null;

  const sb = Number(smallBlind);
  const bb = Number(bigBlind);
  // Client-side validation is UX only; the server (Zod + domain) is the
  // authority on blind values.
  const blindsValid =
    Number.isInteger(sb) && Number.isInteger(bb) && sb > 0 && bb > sb;

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
      // Already a member? You're not locked out — just take a seat at that
      // table. (Membership persists, so re-entering a code is a normal way back
      // in, not an error.)
      if (err.code === 'ALREADY_IN_ROOM' && event.type === 'room:join') {
        router.push(`/room/${event.payload.roomId}`);
        return;
      }
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
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/history')}
            className="text-xs text-vc-ink-faint underline-offset-2 transition hover:text-vc-ink-muted hover:underline"
          >
            View history
          </button>
          <button
            onClick={() => void signOut()}
            className="text-xs text-vc-ink-faint underline-offset-2 transition hover:text-vc-ink-muted hover:underline"
          >
            Leave
          </button>
        </div>
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

      {activeTable !== null && (
        <section className="flex flex-col gap-3 rounded-xl border border-white/[0.06] bg-black/20 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-vc-ink-muted">
            Your table
          </h2>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium text-vc-ink">
                {activeTable.name}
              </p>
              {activeTable.status === 'playing' && (
                <p className="text-xs text-vc-ink-faint">In progress</p>
              )}
            </div>
            <button
              onClick={() => router.push(`/room/${activeTable.roomId}`)}
              className="shrink-0 rounded-xl bg-vc-emerald px-4 py-2.5 font-semibold text-vc-felt-edge shadow-[0_8px_20px_-6px_rgb(52_211_153/0.5)] transition hover:bg-vc-emerald/90 active:scale-[0.99]"
            >
              Rejoin
            </button>
          </div>
        </section>
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
        <div className="flex gap-3">
          <label className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="text-[11px] uppercase tracking-[0.08em] text-vc-ink-faint">
              Small blind
            </span>
            <input
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={smallBlind}
              onChange={(e) => setSmallBlind(e.target.value)}
              className={`${fieldClass} w-full`}
            />
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="text-[11px] uppercase tracking-[0.08em] text-vc-ink-faint">
              Big blind
            </span>
            <input
              type="number"
              min={2}
              step={1}
              inputMode="numeric"
              value={bigBlind}
              onChange={(e) => setBigBlind(e.target.value)}
              className={`${fieldClass} w-full`}
            />
          </label>
        </div>
        {!blindsValid && (smallBlind !== '' || bigBlind !== '') && (
          <p className="text-xs text-vc-ink-faint">
            Blinds must be whole numbers with the big blind larger than the
            small blind.
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-[0.08em] text-vc-ink-faint">
            Settling pots
          </span>
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-black/25 p-1">
            {(
              [
                { value: 'banker', label: 'Banker decides' },
                { value: 'showdown', label: 'Players claim' },
              ] as const
            ).map((opt) => {
              const active = settlementMode === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSettlementMode(opt.value)}
                  aria-pressed={active}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active
                      ? 'bg-vc-emerald/90 text-vc-felt-edge shadow-[0_6px_16px_-8px_rgb(52_211_153/0.6)]'
                      : 'text-vc-ink-muted hover:text-vc-ink'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-vc-ink-faint">
            {settlementMode === 'banker'
              ? 'Banker decides: you pick each pot’s winner.'
              : 'Players claim: players claim win/muck, you confirm.'}
          </p>
        </div>
        <button
          onClick={() =>
            run({
              type: 'room:create',
              payload: {
                name,
                settings: { smallBlind: sb, bigBlind: bb, settlementMode },
              },
            })
          }
          disabled={
            !connected || busy || name.trim().length === 0 || !blindsValid
          }
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
