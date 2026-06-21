import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock framer-motion's `useReducedMotion` with a plain function (no real React
// hook state) so the wrapper can be invoked directly in the node test env.
// `vi.hoisted` keeps the spy available inside the hoisted `vi.mock` factory.
const { useReducedMotion } = vi.hoisted(() => ({
  useReducedMotion: vi.fn<() => boolean | null>(),
}));
vi.mock('framer-motion', () => ({ useReducedMotion }));

import { selectVariants, useMotionVariants } from './reduced-motion';
import {
  chipFly,
  playerEnter,
  seatHighlight,
  winPulse,
  type MotionVariantSet,
} from './variants';

const presets: ReadonlyArray<readonly [string, MotionVariantSet]> = [
  ['chipFly', chipFly],
  ['seatHighlight', seatHighlight],
  ['playerEnter', playerEnter],
  ['winPulse', winPulse],
];

describe('selectVariants', () => {
  for (const [name, set] of presets) {
    it(`returns the full variant when reduced-motion is off (${name})`, () => {
      expect(selectVariants(set, false)).toBe(set.full);
    });

    it(`returns the degraded variant when reduced-motion is on (${name})`, () => {
      expect(selectVariants(set, true)).toBe(set.reduced);
    });
  }
});

describe('useMotionVariants', () => {
  beforeEach(() => {
    useReducedMotion.mockReset();
  });

  for (const [name, set] of presets) {
    it(`returns the full variant when reduced-motion is off (${name})`, () => {
      useReducedMotion.mockReturnValue(false);
      expect(useMotionVariants(set)).toBe(set.full);
    });

    it(`returns the degraded variant when reduced-motion is on (${name})`, () => {
      useReducedMotion.mockReturnValue(true);
      expect(useMotionVariants(set)).toBe(set.reduced);
    });
  }

  it('fails safe: an unresolved (null) preference degrades to the reduced variant', () => {
    // framer-motion returns null during SSR / before the listener resolves.
    // We must not show full motion to a user who may have asked for none.
    useReducedMotion.mockReturnValue(null);
    expect(useMotionVariants(chipFly)).toBe(chipFly.reduced);
  });
});
