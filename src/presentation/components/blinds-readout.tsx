export interface BlindsReadoutProps {
  readonly smallBlind: number;
  readonly bigBlind: number;
}

/**
 * Formats the small/big blind pair as a tote-board readout, e.g. "1 / 2" or
 * "100 / 200" with thousands grouping. Pure so it can be unit-tested without a
 * DOM.
 */
export function formatBlinds(smallBlind: number, bigBlind: number): string {
  return `${smallBlind.toLocaleString()} / ${bigBlind.toLocaleString()}`;
}

/**
 * A small static readout of the table's blinds, sourced from the room settings.
 * Tote-board styling (vc-design): a quiet uppercase label over a tabular mono
 * number — informational, so it stays in ink rather than gold (gold = money
 * moments: pot, dealer button, payouts).
 */
export function BlindsReadout({
  smallBlind,
  bigBlind,
}: BlindsReadoutProps): React.ReactElement {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-vc-ink-muted">
        Blinds
      </span>
      <span className="font-mono text-xs font-semibold tabular-nums text-vc-ink [text-shadow:0_1px_4px_rgb(0_0_0/0.55)]">
        {formatBlinds(smallBlind, bigBlind)}
      </span>
    </div>
  );
}
