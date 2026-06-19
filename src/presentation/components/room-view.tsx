'use client';

import { motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActionPanel } from './action-panel';
import { deriveActions, type ActionKind } from './action-availability';
import { BankerBar } from './banker-bar';
import { PokerTable } from './poker-table';
import { ShowdownControls } from './showdown-controls';
import { getSocket } from '@/presentation/lib/socket';
import { friendlyError } from '@/presentation/lib/error-messages';
import type {
  HandSettled,
  PublicHandState,
  PublicRoomState,
  SocketError,
} from '@/presentation/lib/socket-events';
import { useConnectionStore } from '@/presentation/stores/connection-store';

export function RoomView({ roomId }: { roomId: string }): React.ReactElement {
  const reduce = useReducedMotion();
  const status = useConnectionStore((s) => s.status);
  const user = useConnectionStore((s) => s.user);
  const [room, setRoom] = useState<PublicRoomState | null>(null);
  const [hand, setHand] = useState<PublicHandState | null>(null);
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [payouts, setPayouts] = useState<HandSettled['payouts'] | null>(null);

  useEffect(() => {
    const socket = getSocket();
    const onState = (state: PublicRoomState): void => setRoom(state);
    const onHand = (state: PublicHandState): void => {
      // A fresh hand state means our last action landed (or the turn moved on).
      setHand(state);
      setPending(false);
      setActionError(null);
      // A new betting hand clears the previous hand's result banner.
      if (state.status === 'betting') setPayouts(null);
    };
    const onSettled = (result: HandSettled): void => {
      setPending(false);
      setPayouts(result.payouts);
    };
    const onError = (err: SocketError): void => {
      setPending(false);
      setActionError(friendlyError(err.code, err.message));
    };
    socket.on('room:state', onState);
    socket.on('hand:state', onHand);
    socket.on('hand:settled', onSettled);
    socket.on('error', onError);

    // Ask for the current snapshot (works on first load and on reconnect).
    const resync = (): void => {
      socket.emit('room:resync', { roomId });
    };
    if (socket.connected) resync();
    socket.on('session:ready', resync);

    return () => {
      socket.off('room:state', onState);
      socket.off('hand:state', onHand);
      socket.off('hand:settled', onSettled);
      socket.off('error', onError);
      socket.off('session:ready', resync);
    };
  }, [roomId]);

  // The seat the current user occupies (null if they are only watching).
  const heroSeat = useMemo(() => {
    if (room === null || user === null) return null;
    return room.members.find((m) => m.username === user.username)?.seat ?? null;
  }, [room, user]);

  const act = useCallback(
    (action: ActionKind, amount?: number): void => {
      setPending(true);
      setActionError(null);
      getSocket().emit('player:act', { roomId, action, amount });
    },
    [roomId],
  );

  const startHand = useCallback((): void => {
    setPending(true);
    setActionError(null);
    getSocket().emit('hand:start', { roomId });
  }, [roomId]);

  const settle = useCallback(
    (declarations: number[][]): void => {
      setPending(true);
      setActionError(null);
      getSocket().emit('hand:settle', { roomId, declarations });
    },
    [roomId],
  );

  // A live hand blocks dealing; treat a settled hand as no hand in play.
  const handInPlay = hand !== null && hand.status !== 'settled';
  const heroIsBanker =
    heroSeat !== null &&
    (room?.members.find((m) => m.seat === heroSeat)?.isBanker ?? false);

  const availability = deriveActions(
    hand,
    heroSeat,
    room?.settings.bigBlind ?? 0,
  );

  // Whose turn it is, for the panel's waiting state.
  const actingName =
    hand?.actingSeat != null
      ? room?.members.find((m) => m.seat === hand.actingSeat)?.username
      : undefined;

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
          className="flex flex-1 flex-col gap-4"
        >
          <div className="text-center">
            <h1 className="font-display text-2xl font-bold tracking-tightish text-vc-ink">
              {room.name}
            </h1>
            <p className="text-sm text-vc-ink-muted">
              {room.members.length} seated · {room.status}
            </p>
          </div>

          {/* Banker deal control, except at showdown where settling takes over. */}
          {heroIsBanker && hand?.status !== 'awaiting_showdown' && (
            <BankerBar
              handInPlay={handInPlay}
              resuming={hand?.status === 'settled'}
              pending={pending}
              error={actionError}
              onStartHand={startHand}
            />
          )}

          <PokerTable room={room} hand={hand} />

          {/* Result of the last settled hand, until the next deal. */}
          {payouts !== null &&
            payouts.length > 0 &&
            hand?.status === 'settled' && (
              <p className="text-center text-sm text-vc-ink-muted">
                {payouts.map((p, i) => (
                  <span key={p.seat}>
                    {i > 0 && ' · '}
                    <span className="font-medium text-vc-ink">
                      {room.members.find((m) => m.seat === p.seat)?.username ??
                        `Seat ${p.seat}`}
                    </span>{' '}
                    won{' '}
                    <span className="font-mono tabular-nums text-vc-gold">
                      {p.amount.toLocaleString()}
                    </span>
                  </span>
                ))}
              </p>
            )}

          {hand?.status === 'awaiting_showdown' ? (
            <ShowdownControls
              hand={hand}
              members={room.members}
              isBanker={heroIsBanker}
              pending={pending}
              error={actionError}
              onSettle={settle}
            />
          ) : (
            // Remounting on turn/bet change resets the local sizing controls.
            <ActionPanel
              key={`${hand?.id ?? 'none'}:${hand?.actingSeat ?? 'x'}:${hand?.currentBet ?? 0}`}
              availability={availability}
              pot={hand?.totalPot ?? 0}
              currentBet={hand?.currentBet ?? 0}
              pending={pending}
              error={actionError}
              actingName={actingName}
              onAct={act}
            />
          )}
        </motion.div>
      )}
    </main>
  );
}
