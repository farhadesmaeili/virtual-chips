import { notFound } from 'next/navigation';
import { PokerTable } from '@/presentation/components/poker-table';
import type {
  PublicHandState,
  PublicRoomState,
} from '@/presentation/lib/socket-events';

// A development-only surface for reviewing the table's visual/layout work (4.2)
// with a fully-populated 9-max table — active turn ring, pot, dealer button,
// bets, a folded seat and an all-in. Not part of the product; returns 404 in
// production so it never ships.

const room: PublicRoomState = {
  id: 'preview',
  name: 'Friday night game',
  status: 'playing',
  settings: {
    actionTimeoutMs: 30_000,
    smallBlind: 1,
    bigBlind: 2,
    settlementMode: 'banker',
  },
  members: [
    {
      seat: 1,
      username: 'You',
      chips: 3400,
      buyInTotal: 4000,
      isBanker: false,
    },
    {
      seat: 2,
      username: 'Mara',
      chips: 2120,
      buyInTotal: 2000,
      isBanker: true,
    },
    { seat: 3, username: 'Devon Park', chips: 980, buyInTotal: 2000, isBanker: false }, // prettier-ignore
    {
      seat: 5,
      username: 'Ines',
      chips: 5600,
      buyInTotal: 4000,
      isBanker: false,
    },
    { seat: 6, username: 'Kofi', chips: 0, buyInTotal: 2000, isBanker: false },
    {
      seat: 8,
      username: 'Lena R',
      chips: 1750,
      buyInTotal: 2000,
      isBanker: false,
    },
  ],
};

const hand: PublicHandState = {
  id: 'preview-hand',
  roomId: 'preview',
  street: 1,
  buttonSeat: 2,
  currentBet: 40,
  actingSeat: 1,
  actionDeadline: Date.now() + 22_000,
  status: 'betting',
  players: [
    { seat: 1, stack: 3400, committedThisStreet: 20, committedTotal: 20, state: 'active', hasActedThisStreet: false }, // prettier-ignore
    { seat: 2, stack: 2120, committedThisStreet: 40, committedTotal: 40, state: 'active', hasActedThisStreet: true }, // prettier-ignore
    { seat: 3, stack: 980, committedThisStreet: 0, committedTotal: 0, state: 'folded', hasActedThisStreet: true }, // prettier-ignore
    { seat: 5, stack: 0, committedThisStreet: 200, committedTotal: 200, state: 'all_in', hasActedThisStreet: true }, // prettier-ignore
    { seat: 6, stack: 0, committedThisStreet: 0, committedTotal: 0, state: 'sitting_out', hasActedThisStreet: false }, // prettier-ignore
    { seat: 8, stack: 1750, committedThisStreet: 40, committedTotal: 40, state: 'active', hasActedThisStreet: true }, // prettier-ignore
  ],
  pots: [{ amount: 300, eligibleSeats: [1, 2, 5, 8] }],
  totalPot: 300,
};

export default function TablePreviewPage(): React.ReactElement {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <main className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-4xl flex-col justify-center gap-4 p-6">
      <p className="text-center font-mono text-xs uppercase tracking-[0.2em] text-vc-ink-faint">
        Table preview · dev only
      </p>
      <PokerTable room={room} hand={hand} />
    </main>
  );
}
