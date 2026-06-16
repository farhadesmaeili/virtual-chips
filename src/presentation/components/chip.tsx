import type { CSSProperties } from 'react';

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
