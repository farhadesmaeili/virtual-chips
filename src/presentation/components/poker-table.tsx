'use client';

import { AnimatePresence, LayoutGroup } from 'framer-motion';
import { streetName } from '@/domain/engine';
import { BlindsReadout } from './blinds-readout';
import { ChipStack } from './chip';
import { ChipMotionLayer, type ChipFlight } from './chip-motion-layer';
import { Seat } from './seat';
import { MAX_SEATS, seatSlots } from './seat-layout';
import { highlightSeat, seatPresenceKey } from './table-presence';
import type {
  PublicHandState,
  PublicRoomState,
} from '@/presentation/lib/socket-events';

export interface PokerTableProps {
  readonly room: PublicRoomState;
  /** Live hand state when a hand is in play; null between hands (4.2 wiring). */
  readonly hand?: PublicHandState | null;
  /** In-flight chip animations (task 5.1); driven by live events, not state. */
  readonly flights?: readonly ChipFlight[];
  /** Removes a finished flight so it cleans itself up. */
  readonly onFlightDone?: (id: string) => void;
}

/**
 * The poker table: a lamp-lit felt oval framed by a stitched walnut rail, with
 * up to {@link MAX_SEATS} seats around it. Pure presentation driven by room +
 * hand state; responsive (portrait on mobile, landscape on desktop) and built
 * for Phase 5 animation (per-seat countdown ring, chips→pot, turn highlight).
 */
export function PokerTable({
  room,
  hand = null,
  flights = [],
  onFlightDone,
}: PokerTableProps): React.ReactElement {
  const slots = seatSlots(MAX_SEATS);
  const memberBySeat = new Map(room.members.map((m) => [m.seat, m]));
  const playerBySeat = new Map((hand?.players ?? []).map((p) => [p.seat, p]));
  const inPlay = hand !== null && hand.status !== 'settled';
  const livePot = inPlay ? hand.totalPot : 0;
  // Side pots come straight from the authoritative hand state.
  const sidePots = inPlay && hand.pots.length > 1 ? hand.pots : [];
  // Seat the turn highlight slides to (null between turns / streets).
  const activeSeat = highlightSeat(hand);

  return (
    <div className="vc-table-stage w-full pb-10 pt-2">
      <div className="relative mx-auto aspect-[4/5] w-full max-w-[34rem] sm:aspect-[16/10] sm:max-w-[44rem]">
        <div className="vc-table absolute inset-0">
          {/* Rail framing the felt. */}
          <div className="vc-rail absolute inset-0 p-[6%] sm:p-[4%]">
            <div className="vc-felt-oval relative h-full w-full">
              {/* Center tote board — the pot lives in the lit zone. */}
              <div className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2">
                <div className="vc-lift-pot flex flex-col items-center text-center">
                  {/* Current stage name (preflop/flop/turn/river) — task 4.7. */}
                  {inPlay && (
                    <span className="mb-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-vc-ink-muted">
                      {streetName(hand.street)}
                    </span>
                  )}
                  {livePot > 0 ? (
                    <>
                      {/* The pot pile — gold (value), and the anchor chips
                          spring to in Phase 5. */}
                      <ChipStack
                        amount={livePot}
                        size={24}
                        height={4}
                        color="var(--vc-chip-1000)"
                        className="mb-1.5"
                      />
                      <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-vc-ink-muted">
                        Pot
                      </span>
                      <span className="font-mono text-2xl font-bold tabular-nums text-vc-gold [text-shadow:0_2px_8px_rgb(0_0_0/0.6)] sm:text-3xl">
                        {livePot.toLocaleString()}
                      </span>
                      {sidePots.length > 0 && (
                        <div className="mt-1 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5">
                          {sidePots.map((pot, i) => (
                            <span
                              key={i}
                              className="font-mono text-[11px] tabular-nums text-vc-ink-muted"
                            >
                              <span className="text-vc-ink-faint">
                                {i === 0 ? 'Main' : `Side ${i}`}{' '}
                              </span>
                              {pot.amount.toLocaleString()}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-xs font-medium tracking-wide text-vc-ink-faint">
                      {room.status === 'waiting'
                        ? 'Waiting for the deal'
                        : 'No pot yet'}
                    </span>
                  )}

                  {/* Static blinds readout — always visible, sourced from the
                      room settings (task 4.10). Kept inside the center tote
                      board (the only seat-free zone in every seat-count layout)
                      so it reads as table info and never overlaps an avatar. */}
                  <div className="mt-2.5 border-t border-white/5 pt-2">
                    <BlindsReadout
                      smallBlind={room.settings.smallBlind}
                      bigBlind={room.settings.bigBlind}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Seats sit at the rail; the overlay spans the table box but tucks in
              horizontally on mobile so side seats and nameplates never clip.
              LayoutGroup scopes the shared-layout turn highlight; AnimatePresence
              animates join/leave/swap (keyed by seat + occupant), with
              `initial={false}` so seats present on first load don't pop in. */}
          <div className="absolute inset-y-0 inset-x-[9%] sm:inset-x-0">
            <LayoutGroup>
              <AnimatePresence initial={false}>
                {slots.map((slot) => {
                  const member = memberBySeat.get(slot.seat);
                  return (
                    <Seat
                      key={seatPresenceKey(slot.seat, member)}
                      slot={slot}
                      member={member}
                      handPlayer={playerBySeat.get(slot.seat)}
                      isActing={activeSeat === slot.seat}
                      isButton={hand?.buttonSeat === slot.seat}
                      actionDeadline={hand?.actionDeadline ?? null}
                      actionTimeoutMs={room.settings.actionTimeoutMs}
                    />
                  );
                })}
              </AnimatePresence>
            </LayoutGroup>

            {/* Chips in flight (player→pot, pot→winner). Shares the seat-overlay
                coordinate space so endpoints line up with seats. */}
            <ChipMotionLayer
              flights={flights}
              onDone={onFlightDone ?? (() => undefined)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
