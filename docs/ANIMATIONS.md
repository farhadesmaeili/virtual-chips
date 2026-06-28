# docs/ANIMATIONS.md — Animation guide (mandatory)

Animations are a core part of the product experience. Library: **Framer Motion**.

## Base principles

- Animate only `transform` and `opacity` (not `width/top/left`) so compositing stays on the GPU and there is no jank.
- Natural spring transitions: `type: 'spring', stiffness, damping` instead of linear easing for physical movements.
- Use `AnimatePresence` for mount/unmount.
- Always respect `prefers-reduced-motion`: in that case reduce animations to a simple fade or instant (`useReducedMotion`).
- Target 60fps; test on mobile.

## List of required animations

### 1. Chip motion — the most important

- Player → pot: chips spring from in front of the player's seat to the center of the table.
- pot → winner: on `hand:settled`, chips fly toward the winner.
- Multiple chips with `staggerChildren` for a stack feel.

### 2. Timer ring (Countdown ring)

- An SVG ring around the active player's avatar that fills/empties with `actionDeadline`.
- Near the end: color change to red + a gentle pulse.
- Computed from the server deadline (not a tick).

### 3. Turn change

- A highlight that moves smoothly between seats (`layoutId` for a shared layout animation).

### 4. Player enter/leave

- `AnimatePresence` with scale + fade.

### 5. Win effect (Celebration)

- Winner: glow + scale pop + (optional) light particles/confetti.

### 6. Dealer button & blinds

- Smooth button movement with a spring at the start of each hand.

## Suggested structure

- A `presentation/animations/` module with shared variants and transition presets.
- presets: `chipFly`, `seatHighlight`, `playerEnter`, `winPulse` — so they stay consistent.
