'use client';

import { useState } from 'react';
import { ActionPanel } from './action-panel';
import { deriveActions, type ActionKind } from './action-availability';
import { PokerTable } from './poker-table';
import type {
  PublicHandState,
  PublicRoomState,
} from '@/presentation/lib/socket-events';

// A development-only surface (see /table-preview) for reviewing the table and
// the action panel with a fully-populated 9-max hand. Actions are local only —
// there is no socket — so the panel can be exercised without a live game.

const room: PublicRoomState = {
  id: 'preview',
  name: 'Friday night game',
  status: 'playing',
  settings: {
    actionTimeoutMs: 30_000,
    smallBlind: 10,
    bigBlind: 20,
    settlementMode: 'banker',
  },
  members: [
    {
      seat: 0,
      username: 'You',
      chips: 3400,
      buyInTotal: 4000,
      isBanker: false,
      sittingOut: false,
    },
    {
      seat: 1,
      username: 'Mara',
      chips: 2120,
      buyInTotal: 2000,
      isBanker: true,
      sittingOut: false,
    },
    { seat: 2, username: 'Devon Park', chips: 980, buyInTotal: 2000, isBanker: false, sittingOut: false }, // prettier-ignore
    {
      seat: 4,
      username: 'Ines',
      chips: 5600,
      buyInTotal: 4000,
      isBanker: false,
      sittingOut: false,
    },
    { seat: 5, username: 'Kofi', chips: 0, buyInTotal: 2000, isBanker: false, sittingOut: true }, // prettier-ignore
    { seat: 7, username: 'Lena R', chips: 1750, buyInTotal: 2000, isBanker: false, sittingOut: false }, // prettier-ignore
  ],
};

const hand: PublicHandState = {
  id: 'preview-hand',
  roomId: 'preview',
  street: 1,
  buttonSeat: 1,
  currentBet: 40,
  lastRaiseSize: 20,
  actingSeat: 0,
  actionDeadline: Date.now() + 22_000,
  status: 'betting',
  players: [
    { seat: 0, stack: 3400, committedThisStreet: 20, committedTotal: 20, state: 'active', hasActedThisStreet: false, timeExtensionsRemaining: 2 }, // prettier-ignore
    { seat: 1, stack: 2120, committedThisStreet: 40, committedTotal: 40, state: 'active', hasActedThisStreet: true, timeExtensionsRemaining: 2 }, // prettier-ignore
    { seat: 2, stack: 980, committedThisStreet: 0, committedTotal: 0, state: 'folded', hasActedThisStreet: true, timeExtensionsRemaining: 2 }, // prettier-ignore
    { seat: 4, stack: 0, committedThisStreet: 200, committedTotal: 200, state: 'all_in', hasActedThisStreet: true, timeExtensionsRemaining: 2 }, // prettier-ignore
    { seat: 5, stack: 0, committedThisStreet: 0, committedTotal: 0, state: 'sitting_out', hasActedThisStreet: false, timeExtensionsRemaining: 2 }, // prettier-ignore
    { seat: 7, stack: 1750, committedThisStreet: 40, committedTotal: 40, state: 'active', hasActedThisStreet: true, timeExtensionsRemaining: 2 }, // prettier-ignore
  ],
  pots: [{ amount: 300, eligibleSeats: [0, 1, 4, 7] }],
  totalPot: 300,
};

const HERO_SEAT = 0;

export function TablePreview(): React.ReactElement {
  const [lastAction, setLastAction] = useState<string | null>(null);
  const availability = deriveActions(hand, HERO_SEAT, room.settings.bigBlind);

  const onAct = (action: ActionKind, amount?: number): void => {
    setLastAction(amount === undefined ? action : `${action} ${amount}`);
  };

  return (
    <main className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-4xl flex-col justify-center gap-4 p-6">
      <p className="text-center font-mono text-xs uppercase tracking-[0.2em] text-vc-ink-faint">
        Table preview · dev only
        {lastAction !== null && (
          <span className="ml-2 text-vc-emerald">→ {lastAction}</span>
        )}
      </p>
      <PokerTable room={room} hand={hand} />
      <ActionPanel
        availability={availability}
        pot={hand.totalPot}
        currentBet={hand.currentBet}
        pending={false}
        error={null}
        onAct={onAct}
      />
    </main>
  );
}
