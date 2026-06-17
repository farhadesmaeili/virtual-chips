import type { CSSProperties } from 'react';
import { chipColor, topDenomination } from './chip-denominations';

/**
 * A semi-3D casino chip — the brand atom (vc-design). Pure CSS depth (layered
 * shadows, edge spots), light enough for mobile. `color` is a denomination
 * color (defaults to the green $25 chip).
 */
export function Chip({
  size = 56,
  color = 'var(--vc-chip-25)',
  label,
  className,
}: {
  size?: number;
  color?: string;
  label?: string;
  className?: string;
}): React.ReactElement {
  return (
    <span
      aria-hidden={label === undefined}
      className={`vc-chip grid place-items-center ${className ?? ''}`}
      style={{ width: size, height: size, '--chip': color } as CSSProperties}
    >
      {label !== undefined && (
        <span className="font-mono text-[0.62em] font-semibold tracking-tight text-white/90 [text-shadow:0_1px_1px_rgb(0_0_0/0.4)]">
          {label}
        </span>
      )}
    </span>
  );
}

/**
 * A short physical stack of chips, tinted by the amount's top denomination
 * (vc-design: stacks read as height via translateY offsets). Used for bets in
 * front of a seat and for the pot; the whole stack is one transform target so
 * Phase 5 can spring it to the pot / winner.
 */
export function ChipStack({
  amount,
  size = 18,
  height = 3,
  color,
  className,
}: {
  amount: number;
  /** Diameter of each chip disc. */
  size?: number;
  /** Number of discs to stack (visual height, not exact change). */
  height?: number;
  /** Override tint (e.g. gold for the pot); defaults to the top denomination. */
  color?: string;
  className?: string;
}): React.ReactElement {
  const tint = color ?? chipColor(topDenomination(amount));
  const offset = Math.max(2, Math.round(size * 0.16));
  const count = Math.max(1, height);

  return (
    <span
      aria-hidden
      className={`relative inline-block ${className ?? ''}`}
      style={{ width: size, height: size + (count - 1) * offset }}
    >
      {Array.from({ length: count }, (_, i) => (
        // Lowest disc at the bottom; each sits a little higher to read as height.
        <span
          key={i}
          className="vc-chip absolute left-0"
          style={
            {
              width: size,
              height: size,
              bottom: i * offset,
              '--chip': tint,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}
