'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActionMenu } from './action-menu';
import { ActionPanel } from './action-panel';
import { deriveActions, type ActionKind } from './action-availability';
import { deriveMenuItems } from './menu-availability';
import { NetReport } from './net-report';
import { buildNetReport } from './net-report-model';
import { type ChipMotion, flightsFor, planChipMotion } from './chip-motion';
import { type ChipFlight } from './chip-motion-layer';
import { celebrationBursts } from './celebration';
import { type Celebration } from './celebration-layer';
import { PokerTable } from './poker-table';
import { RoomIdBadge } from './room-id-badge';
import { ShowdownClaimControls } from './showdown-claim-controls';
import { type ClaimChoice } from './showdown-claim-model';
import { ShowdownControls } from './showdown-controls';
import { StartHandControl } from './start-hand-control';
import { StreetControls } from './street-controls';
import { TurnBanner } from './turn-banner';
import { useReducedMotionPreference } from '@/presentation/animations';
import { getSocket } from '@/presentation/lib/socket';
import { friendlyError } from '@/presentation/lib/error-messages';
import type {
  ActionApplied,
  ChipRequestList,
  GameEnded,
  HandSettled,
  PublicChipRequest,
  PublicHandState,
  PublicRoomState,
  SocketError,
} from '@/presentation/lib/socket-events';
import { useConnectionStore } from '@/presentation/stores/connection-store';

export function RoomView({ roomId }: { roomId: string }): React.ReactElement {
  const reduce = useReducedMotionPreference();
  const router = useRouter();
  const status = useConnectionStore((s) => s.status);
  const user = useConnectionStore((s) => s.user);
  const [room, setRoom] = useState<PublicRoomState | null>(null);
  const [hand, setHand] = useState<PublicHandState | null>(null);
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [fundingError, setFundingError] = useState<string | null>(null);
  const [payouts, setPayouts] = useState<HandSettled['payouts'] | null>(null);
  const [chipRequests, setChipRequests] = useState<
    readonly PublicChipRequest[]
  >([]);
  // End-of-game net settlement (task 6.2). Local/ephemeral by construction:
  // raised only by the LIVE game:ended handler below, never rebuilt from a
  // snapshot. A reconnect to an already-ended game therefore shows the quiet
  // "this game has ended" note with no numbers (full history is task 6.3).
  const [netReport, setNetReport] = useState<GameEnded | null>(null);
  // In-flight chip animations (task 5.1). Triggered only by LIVE events below;
  // never reconstructed from a snapshot, so a resync replays no chip flights.
  const [flights, setFlights] = useState<readonly ChipFlight[]>([]);
  const flightId = useRef(0);
  const removeFlight = useCallback((id: string): void => {
    setFlights((prev) => prev.filter((f) => f.id !== id));
  }, []);
  // Win celebrations (task 5.4). Like flights, raised only by the LIVE
  // hand:settled handler below — never reconstructed from a snapshot, so a resync
  // replays no celebration.
  const [celebrations, setCelebrations] = useState<readonly Celebration[]>([]);
  const celebrationId = useRef(0);
  const removeCelebration = useCallback((id: string): void => {
    setCelebrations((prev) => prev.filter((c) => c.id !== id));
  }, []);
  // Which control owns the next error: a betting/hand action or a funding one.
  const intent = useRef<'action' | 'funding'>('action');
  // Set while a leave is in flight, so only the leaver returns to the lobby
  // (other members just see the updated room state).
  const leaving = useRef(false);
  // Mirror router/user in refs so the socket effect can use them without
  // re-binding its listeners whenever they change (it binds once per room).
  const routerRef = useRef(router);
  routerRef.current = router;
  const userRef = useRef(user);
  userRef.current = user;
  // Current pot, mirrored so the once-bound socket effect can read it as the
  // tint fallback for a commit whose amount is unknown (call/all-in).
  const potRef = useRef(0);
  potRef.current = hand?.totalPot ?? 0;

  useEffect(() => {
    const socket = getSocket();
    // Turn a LIVE chip motion into rendered flights. Called only from the
    // transient action:applied / hand:settled handlers — never from a snapshot.
    const enqueue = (motion: ChipMotion | null): void => {
      if (motion === null) return;
      setFlights((prev) => [
        ...prev,
        ...flightsFor(motion, potRef.current).map((spec) => ({
          ...spec,
          id: `flight-${(flightId.current += 1)}`,
        })),
      ]);
    };
    const onState = (state: PublicRoomState): void => {
      setRoom(state);
      // room:state is the success response for presence actions (sit out / sit
      // in / leave), which have no hand:state to follow. Clear the in-flight
      // flag here too, or the controls stay disabled until the next hand —
      // which never comes when everyone has sat out (task 4.14 bug-2).
      setPending(false);
      // If our own leave landed, the snapshot no longer lists us → go to lobby.
      if (leaving.current) {
        const me = userRef.current;
        const stillSeated =
          me !== null && state.members.some((m) => m.username === me.username);
        if (!stillSeated) {
          leaving.current = false;
          routerRef.current.push('/');
        }
      }
    };
    const onHand = (state: PublicHandState): void => {
      // A fresh hand state means our last action landed (or the turn moved on).
      setHand(state);
      setPending(false);
      setActionError(null);
      // A new betting hand clears the previous hand's result banner.
      if (state.status === 'betting') setPayouts(null);
    };
    const onAction = (event: ActionApplied): void => {
      // player→pot on a live committing action (bet/call/raise/all-in).
      enqueue(planChipMotion({ type: 'action', event }));
    };
    // Turn a LIVE settlement into win celebrations. Reads the SAME internal
    // ChipMotion model the chip flights use (motion.awards) — not the raw socket
    // payload — so it inherits the live-only guarantee and is unaffected if the
    // payouts[]/awards[] contract doc-drift is later reconciled.
    const cheer = (motion: ChipMotion | null): void => {
      const bursts = celebrationBursts(motion);
      if (bursts.length === 0) return;
      setCelebrations((prev) => [
        ...prev,
        ...bursts.map((b) => ({
          ...b,
          id: `cheer-${(celebrationId.current += 1)}`,
        })),
      ]);
    };
    const onSettled = (result: HandSettled): void => {
      setPending(false);
      setPayouts(result.payouts);
      // pot→winner(s) chips + win celebration, both from the one live settlement.
      const motion = planChipMotion({ type: 'settled', event: result });
      enqueue(motion);
      cheer(motion);
    };
    const onRequests = (list: ChipRequestList): void => {
      setChipRequests(list.requests);
      setPending(false);
      setFundingError(null);
    };
    // The banker ended the game: keep the live net report for this session only.
    // The accompanying ended room:state (onState) flips the view to settlement.
    const onEnded = (result: GameEnded): void => {
      setPending(false);
      setNetReport(result);
    };
    const onError = (err: SocketError): void => {
      setPending(false);
      // A rejected leave (mid-hand / banker) keeps us in the room.
      leaving.current = false;
      const message = friendlyError(err.code, err.message);
      if (intent.current === 'funding') setFundingError(message);
      else setActionError(message);
    };
    socket.on('room:state', onState);
    socket.on('hand:state', onHand);
    socket.on('action:applied', onAction);
    socket.on('hand:settled', onSettled);
    socket.on('chips:requests', onRequests);
    socket.on('game:ended', onEnded);
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
      socket.off('action:applied', onAction);
      socket.off('hand:settled', onSettled);
      socket.off('chips:requests', onRequests);
      socket.off('game:ended', onEnded);
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
      intent.current = 'action';
      setPending(true);
      setActionError(null);
      getSocket().emit('player:act', { roomId, action, amount });
    },
    [roomId],
  );

  const startHand = useCallback((): void => {
    intent.current = 'action';
    setPending(true);
    setActionError(null);
    getSocket().emit('hand:start', { roomId });
  }, [roomId]);

  const settle = useCallback(
    (declarations: number[][]): void => {
      intent.current = 'action';
      setPending(true);
      setActionError(null);
      getSocket().emit('hand:settle', { roomId, declarations });
    },
    [roomId],
  );

  // Player-showdown claim (mode B, task 6.1). The hero claims `'win'`/`'muck'`
  // for THEMSELVES; the seat is resolved from the session server-side, never
  // sent. Errors flow through the same action-error channel as betting.
  const claim = useCallback(
    (choice: ClaimChoice): void => {
      intent.current = 'action';
      setPending(true);
      setActionError(null);
      getSocket().emit('player:claim', { roomId, claim: choice });
    },
    [roomId],
  );

  // Banker confirm in player-showdown mode (mode B). Deliberately reuses the
  // existing `hand:settle` path with EMPTY declarations: the server seeds the
  // winners from the players' stored claims and ignores client declarations, so
  // the UI never builds per-pot winner sets and never moves a chip.
  const confirmShowdown = useCallback((): void => {
    intent.current = 'action';
    setPending(true);
    setActionError(null);
    getSocket().emit('hand:settle', { roomId, declarations: [] });
  }, [roomId]);

  // End the whole game (task 6.2). The server settles net, persists, and
  // broadcasts game:ended + a fresh ended room:state; the menu already gates
  // this to the banker between hands, and the server re-enforces both.
  const endGame = useCallback((): void => {
    intent.current = 'action';
    setPending(true);
    setActionError(null);
    getSocket().emit('banker:endGame', { roomId });
  }, [roomId]);

  const dealStreet = useCallback((): void => {
    intent.current = 'action';
    setPending(true);
    setActionError(null);
    getSocket().emit('hand:advance-street', { roomId });
  }, [roomId]);

  // Reset the in-progress hand (task 6.6): the banker discards and re-deals the
  // current hand. The server enforces banker-only + the no-hand/settled guards,
  // re-derives stacks from members' chips (no DB chip change) and re-posts blinds.
  const resetHand = useCallback((): void => {
    intent.current = 'action';
    setPending(true);
    setActionError(null);
    getSocket().emit('hand:reset', { roomId });
  }, [roomId]);

  // Time bank (task 4.12). Doesn't set `pending`: the player keeps their turn
  // and may still act; the broadcast hand:state refreshes the deadline + budget.
  const requestTime = useCallback((): void => {
    intent.current = 'action';
    setActionError(null);
    getSocket().emit('turn:request-time', { roomId });
  }, [roomId]);

  const requestChips = useCallback(
    (amount: number): void => {
      intent.current = 'funding';
      setPending(true);
      setFundingError(null);
      getSocket().emit('chips:request', { roomId, amount });
    },
    [roomId],
  );

  const approveChips = useCallback(
    (requestId: string): void => {
      intent.current = 'funding';
      setPending(true);
      setFundingError(null);
      getSocket().emit('chips:approve', { roomId, requestId });
    },
    [roomId],
  );

  const rejectChips = useCallback(
    (requestId: string): void => {
      intent.current = 'funding';
      setPending(true);
      setFundingError(null);
      getSocket().emit('chips:reject', { roomId, requestId });
    },
    [roomId],
  );

  // Banker direct chip adjustment (task 6.7). Targets a member by seat (the
  // public projection carries no userId); amount is signed (+ add / − remove).
  // The server enforces banker-only + between-hands + floor guards.
  const adjustChips = useCallback(
    (seat: number, amount: number): void => {
      intent.current = 'funding';
      setPending(true);
      setFundingError(null);
      getSocket().emit('banker:adjustChips', { roomId, seat, amount });
    },
    [roomId],
  );

  // Seat presence (task 4.14). The acting user is the authenticated socket user;
  // these payloads carry only the roomId.
  const sitOut = useCallback((): void => {
    intent.current = 'action';
    setPending(true);
    setActionError(null);
    getSocket().emit('room:sit-out', { roomId });
  }, [roomId]);

  const sitIn = useCallback((): void => {
    intent.current = 'action';
    setPending(true);
    setActionError(null);
    getSocket().emit('room:sit-in', { roomId });
  }, [roomId]);

  const leave = useCallback((): void => {
    intent.current = 'action';
    leaving.current = true;
    setPending(true);
    setActionError(null);
    getSocket().emit('room:leave', { roomId });
  }, [roomId]);

  // A live hand blocks dealing; treat a settled hand as no hand in play.
  const handInPlay = hand !== null && hand.status !== 'settled';
  const heroMember =
    heroSeat === null
      ? undefined
      : room?.members.find((m) => m.seat === heroSeat);
  const heroIsBanker = heroMember?.isBanker ?? false;

  const availability = deriveActions(
    hand,
    heroSeat,
    room?.settings.bigBlind ?? 0,
  );

  // The unified action menu (task 4.16): which scattered controls to show.
  const menuModel = deriveMenuItems({
    seated: heroSeat !== null,
    sittingOut: heroMember?.sittingOut ?? false,
    isBanker: heroIsBanker,
    handInPlay,
    gameInPlay: room?.status === 'playing',
    handSettled: hand?.status === 'settled',
    hasOwnRequest: chipRequests.some((r) => r.seat === heroSeat),
    requestCount: chipRequests.length,
    pending,
  });

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
        <RoomIdBadge roomId={roomId} />
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

          <TurnBanner hand={hand} members={room.members} heroSeat={heroSeat} />

          <PokerTable
            room={room}
            hand={hand}
            flights={flights}
            onFlightDone={removeFlight}
            celebrations={celebrations}
            onCelebrationDone={removeCelebration}
          />

          {room.status === 'ended' ? (
            // The game is over: show the net settlement and suppress every play
            // tray + the action menu. A live game:ended gives us the numbers; a
            // reconnect to an already-ended game has none, so we say so quietly
            // (full history is task 6.3).
            netReport !== null ? (
              <NetReport
                rows={buildNetReport(netReport.nets, room.members)}
                rake={netReport.rake}
              />
            ) : (
              <p className="text-center text-sm text-vc-ink-muted">
                This game has ended.
              </p>
            )
          ) : (
            <>
              {/* Result of the last settled hand, until the next deal. */}
              {payouts !== null &&
                payouts.length > 0 &&
                hand?.status === 'settled' && (
                  <p className="text-center text-sm text-vc-ink-muted">
                    {payouts.map((p, i) => (
                      <span key={p.seat}>
                        {i > 0 && ' · '}
                        <span className="font-medium text-vc-ink">
                          {room.members.find((m) => m.seat === p.seat)
                            ?.username ?? `Seat ${p.seat}`}
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
                // Split by the room's settlement mode. In showdown mode the
                // players claim and the banker confirms (mode B); otherwise the
                // banker declares winners directly (mode A, unchanged). The
                // server re-enforces the mode, so this is purely which tray shows.
                room.settings.settlementMode === 'showdown' ? (
                  <ShowdownClaimControls
                    hand={hand}
                    members={room.members}
                    heroSeat={heroSeat}
                    isBanker={heroIsBanker}
                    pending={pending}
                    error={actionError}
                    onClaim={claim}
                    onConfirm={confirmShowdown}
                  />
                ) : (
                  <ShowdownControls
                    hand={hand}
                    members={room.members}
                    isBanker={heroIsBanker}
                    pending={pending}
                    error={actionError}
                    onSettle={settle}
                  />
                )
              ) : hand?.status === 'awaiting_street' ? (
                <StreetControls
                  street={hand.street}
                  isBanker={heroIsBanker}
                  pending={pending}
                  error={actionError}
                  onDeal={dealStreet}
                />
              ) : (
                // No phase tray (no live hand): the banker's start-hand control sits
                // with the deal/advance family, above the (waiting) action panel.
                <>
                  <StartHandControl
                    state={menuModel.startHand}
                    onStart={startHand}
                  />
                  {/* Remounting on turn/bet change resets the local sizing controls. */}
                  <ActionPanel
                    key={`${hand?.id ?? 'none'}:${hand?.actingSeat ?? 'x'}:${hand?.currentBet ?? 0}`}
                    availability={availability}
                    pot={hand?.totalPot ?? 0}
                    currentBet={hand?.currentBet ?? 0}
                    pending={pending}
                    error={actionError}
                    actingName={actingName}
                    onAct={act}
                    actionDeadline={hand?.actionDeadline ?? null}
                    timeExtensionsRemaining={
                      hand?.players.find((p) => p.seat === heroSeat)
                        ?.timeExtensionsRemaining ?? 0
                    }
                    onAddTime={requestTime}
                  />
                </>
              )}

              <ActionMenu
                model={menuModel}
                requests={chipRequests}
                members={room.members}
                heroChips={heroMember?.chips ?? 0}
                pending={pending}
                actionError={actionError}
                fundingError={fundingError}
                onSitOut={sitOut}
                onSitIn={sitIn}
                onLeave={leave}
                onRequestChips={requestChips}
                onApproveChips={approveChips}
                onRejectChips={rejectChips}
                onResetHand={resetHand}
                onAdjustChips={adjustChips}
                onEndGame={endGame}
              />
            </>
          )}
        </motion.div>
      )}
    </main>
  );
}
