'use client';

import { motion, type Variants } from 'framer-motion';
import { useEffect, useRef } from 'react';
import {
  chipFly,
  springSnappy,
  useMotionVariants,
  useReducedMotionPreference,
} from '@/presentation/animations';
import { useElementSize } from '@/presentation/hooks/use-element-size';
import { Chip } from './chip';
import type { FlightSpec } from './chip-motion';

/** A live chip flight awaiting render, with a stable id for cleanup. */
export interface ChipFlight extends FlightSpec {
  readonly id: string;
}

// A few chips per flight, staggered, to read as a small travelling stack.
const CHIPS_PER_FLIGHT = 3;
// Lifetime after which a flight removes itself (fire-and-forget). Long enough for
// the spring to arrive; short for the reduced-motion fade.
const FLIGHT_MS = 650;
const FLIGHT_MS_REDUCED = 250;

/**
 * Renders in-flight chips over the table (task 5.1). Endpoints arrive as
 * percentages of this layer (the seat-overlay coordinate space) and are
 * converted to pixels so chips travel via `transform` only. Each flight cleans
 * itself up via `onDone`; nothing is reconstructed from state.
 */
export function ChipMotionLayer({
  flights,
  onDone,
}: {
  readonly flights: readonly ChipFlight[];
  readonly onDone: (id: string) => void;
}): React.ReactElement {
  const [ref, size] = useElementSize<HTMLDivElement>();
  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-30"
    >
      {size !== null &&
        flights.map((flight) => (
          <ChipFlightView
            key={flight.id}
            flight={flight}
            width={size.width}
            height={size.height}
            onDone={onDone}
          />
        ))}
    </div>
  );
}

function ChipFlightView({
  flight,
  width,
  height,
  onDone,
}: {
  readonly flight: ChipFlight;
  readonly width: number;
  readonly height: number;
  readonly onDone: (id: string) => void;
}): React.ReactElement {
  const chipVariants = useMotionVariants(chipFly);
  const reduced = useReducedMotionPreference();

  // Endpoints in px within the layer (transform space — no layout props).
  const fromX = (flight.from.xPct / 100) * width;
  const fromY = (flight.from.yPct / 100) * height;
  const toX = (flight.to.xPct / 100) * width;
  const toY = (flight.to.yPct / 100) * height;

  // Reduced motion: chips do not fly across space — they fade in place at the
  // destination (an instant/fade update), via the 5.0 chipFly reduced variant.
  const startX = reduced ? toX : fromX;
  const startY = reduced ? toY : fromY;

  // Fire-and-forget cleanup, independent of the spring's exact settle time.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  useEffect(() => {
    const id = window.setTimeout(
      () => onDoneRef.current(flight.id),
      reduced ? FLIGHT_MS_REDUCED : FLIGHT_MS,
    );
    return () => window.clearTimeout(id);
  }, [flight.id, reduced]);

  const stagger: Variants = {
    initial: {},
    animate: { transition: { staggerChildren: reduced ? 0 : 0.06 } },
  };

  return (
    <motion.div
      className="absolute left-0 top-0"
      initial={{ x: startX, y: startY }}
      animate={{ x: toX, y: toY }}
      transition={reduced ? { duration: 0 } : springSnappy}
    >
      <motion.div
        className="flex -translate-x-1/2 -translate-y-1/2"
        variants={stagger}
        initial="initial"
        animate="animate"
      >
        {Array.from({ length: CHIPS_PER_FLIGHT }, (_, i) => (
          <motion.span
            key={i}
            variants={chipVariants}
            className={i === 0 ? '' : '-ml-2'}
          >
            <Chip size={16} color="var(--vc-chip-1000)" />
          </motion.span>
        ))}
      </motion.div>
    </motion.div>
  );
}
