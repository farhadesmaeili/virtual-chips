---
name: vc-design
description: Virtual Chips visual identity and design system. Use whenever building, styling, or restyling any Virtual Chips UI — the lobby, the poker table, seats and avatars, chips, the pot, betting controls, the banker view, or any animation — so everything keeps one premium, cohesive, lamp-lit poker-table look. Covers palette, typography, motion, and the layered/3D depth system.
---

# Virtual Chips — Visual Identity

> Read this before touching any UI. Derive every color, type, spacing, and motion
> decision from the tokens here. When something isn't covered, extend the system
> in its spirit — don't reach for a generic default.

## The thesis (what we're designing)

Virtual Chips is a **virtual betting layer** for home poker games. The product is
not a dashboard with cards on it — it is **a table in a quiet room under a single
warm overhead light**. Everything flows from that one image:

- The **felt** is the ground, lit from above (radial highlight + vignette), not a
  flat dark fill.
- A **stitched walnut rail** frames the felt — the casino-table tell most generic
  poker UIs skip. It is what makes the surface read as a _table_, not a `<div>`.
- **Chips** are the brand atom: small, physical, stackable, catching the light.
- **Money is the content.** Pots, stacks, bets and timers are rendered like a
  **tote board** — tabular, mechanical, confident.

Spend boldness in exactly one place: the **lamp-lit felt + chip**. Keep everything
around it quiet and disciplined. Premium, never kitsch — no neon, no slot-machine
glow, no fake-gold gradients on every edge.

**Pitfalls this identity exists to avoid** (the three AI-default looks): cream +
high-contrast serif + terracotta; near-black + one acid-green/vermilion accent;
broadsheet hairline-rule columns. Our felt/rail/gold/denomination-chip system is
the antidote — if a screen starts looking like a dark admin panel with a green
accent, you've drifted; bring back the rail, the lamp, and the chip.

---

## 1. Palette — a lit system, not flat fills

Six core roles plus a **functional** chip-denomination set. Colors are named by
_role_, never reused for an unrelated job.

### Felt (the ground — always lit, never flat)

| token            | hex       | use                                   |
| ---------------- | --------- | ------------------------------------- |
| `--vc-felt-lamp` | `#1B4332` | felt directly under the lamp (center) |
| `--vc-felt`      | `#15392E` | felt surface                          |
| `--vc-felt-deep` | `#103027` | felt toward the rail                  |
| `--vc-felt-edge` | `#0B231C` | vignette / deepest edge               |

The felt is **only ever** drawn as a radial gradient + inset vignette, so the lamp
reads. Never `background: #15392E` alone.

```css
.vc-table {
  background: radial-gradient(
    120% 82% at 50% 12%,
    var(--vc-felt-lamp) 0%,
    var(--vc-felt) 38%,
    var(--vc-felt-deep) 70%,
    var(--vc-felt-edge) 100%
  );
  box-shadow: inset 0 0 180px 48px rgb(0 0 0 / 0.55); /* vignette */
}
```

### Rail (the frame — walnut + stitch)

| token              | hex       | use                            |
| ------------------ | --------- | ------------------------------ |
| `--vc-rail`        | `#2A1E16` | table rail (dark walnut)       |
| `--vc-rail-edge`   | `#4A372A` | rail bevel highlight           |
| `--vc-rail-stitch` | `#6B533E` | hairline stitch along the felt |

### Value — gold (money moments only)

| token            | hex       | use                                          |
| ---------------- | --------- | -------------------------------------------- |
| `--vc-gold`      | `#F4C04A` | dealer button, banker mark, pot, win, payout |
| `--vc-gold-deep` | `#C8922E` | gold borders / shadow                        |

Gold = **value**. Use it for the pot, the dealer button, the banker badge, and the
win moment — _not_ for ordinary text, borders, or hovers. If gold is everywhere it
stops meaning money.

### Action — emerald (the player's agency)

| token               | hex       | use                                    |
| ------------------- | --------- | -------------------------------------- |
| `--vc-emerald`      | `#34D399` | primary actions, your-turn ring, check |
| `--vc-emerald-deep` | `#0E9F6E` | pressed / border                       |

### Ink (text — warm, never sterile pure-white)

| token            | hex       | use                  |
| ---------------- | --------- | -------------------- |
| `--vc-ink`       | `#EDE9E0` | primary text on felt |
| `--vc-ink-muted` | `#9AA39B` | secondary / labels   |
| `--vc-ink-faint` | `#5E6A61` | tertiary / disabled  |

### Danger (fold, loss, errors)

`--vc-danger: #E0584B` (a warm red that rhymes with the $5 chip).

### Chip denominations (functional — color encodes value)

Casino-standard so denomination is readable at a glance; this is information, not
decoration. Each chip = base + a lighter face highlight + edge spots.

| value | hex       | face text |
| ----- | --------- | --------- |
| 1     | `#EDEAE2` | dark      |
| 5     | `#C2473D` | light     |
| 25    | `#2F8F6B` | light     |
| 100   | `#171717` | light     |
| 500   | `#6B4E9E` | light     |
| 1000  | `#C8922E` | dark      |

> Map these into `tailwind.config.ts` under `theme.extend.colors.vc.*` and expose
> the felt/rail roles as CSS variables in `globals.css`. The existing
> `felt`/`felt.dark` tokens correspond to `--vc-felt-lamp` / `--vc-felt-edge`.

---

## 2. Typography & hierarchy

Three deliberate roles. **Not Inter-as-everything.** Numbers get their own face —
they are the product.

- **Display — `Sora`** (600/700), tight tracking (`-0.02em`). Brand, headings, the
  big table moments. Used with restraint. _(Alt: Space Grotesk.)_
- **Body/UI — `Hanken Grotesk`** (400/500/600). Humanist warmth, avoids the
  templated Inter look. All labels, buttons, prose.
- **Data/Money — `Geist Mono`** (500/600) with `font-variant-numeric: tabular-nums`.
  Every pot, stack, bet, blind and timer — the **tote board**. Tabular figures so
  numbers never reflow as chips change. _(Alt: JetBrains Mono.)_

Load via `next/font` (all three are on Google Fonts) and bind to CSS variables
`--font-display`, `--font-body`, `--font-mono`.

**Type scale** (rem): `0.75 · 0.875 · 1 · 1.25 · 1.5 · 2 · 2.75 · 3.5`. Money
readouts step up a size and use the mono face; labels above them are small,
uppercase, `0.08em` tracked, in `--vc-ink-muted`. The contrast between a quiet
label and a loud tabular number _is_ the hierarchy — don't decorate it.

Structural devices (eyebrows, dividers, seat numbers) must encode something true
(a seat index, a street name) — never `01 / 02 / 03` decoration.

---

## 3. Motion (mandatory — see CLAUDE.md §animations)

- **60fps. Animate `transform` and `opacity` only.** Never animate layout
  (width/height/top/left/margin) — chips, highlights and rings move via
  `transform`.
- **Professional springs**, not linear ease. Framer Motion defaults to tune
  toward: chip travel `{ type: 'spring', stiffness: 520, damping: 32 }`; UI
  reveals `{ type: 'spring', stiffness: 300, damping: 30 }`; quick taps
  `{ duration: 0.12 }`.
- **Respect `prefers-reduced-motion`.** Wrap motion in a `useReducedMotion()`
  check; the global CSS already collapses durations, but skip orchestration and
  large travel too. Reduced motion must still be a complete, legible experience.
- **Orchestrate, don't scatter.** One choreographed moment lands harder than ten
  ambient wiggles; extra motion is what makes a UI feel AI-generated.

The moments worth animating (from CLAUDE.md): chips player→pot and pot→winner
(spring + slight arc + settle); the active player's **countdown ring** (driven by
the absolute `actionDeadline`, animate a stroke transform, not per-tick state);
turn handoff between seats; player enter/leave via `AnimatePresence`; the win
celebration (pot collection); dealer-button and blinds gliding.

---

## 4. Depth & 3D — "Level B, with an upgrade path"

**Default: CSS semi-3D.** Light, smooth on mobile, no WebGL.

- `perspective` on the table container; `transform-style: preserve-3d` on the felt
  so seats/chips can tilt into the surface.
- **Layered shadows** for depth, not blur-heavy glows. Chips are discs with an
  inner top highlight, an inner bottom shade, and a soft cast shadow; stacks are
  `translateY` offsets so they read as physical height.

```css
.vc-chip {
  --chip: var(--vc-chip-25);
  border-radius: 9999px;
  background: radial-gradient(
    circle at 50% 34%,
    color-mix(in srgb, var(--chip) 82%, white),
    var(--chip) 62%
  );
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.28),
    inset 0 -3px 6px rgb(0 0 0 / 0.38),
    0 6px 10px rgb(0 0 0 / 0.45);
}
```

**Upgrade path (future, opt-in): three.js for focal elements only.** `three` is
already a dependency, but WebGL is reserved for one or two _focal_, high-impact
moments — e.g., a hero chip on the lobby, or the pot-collection flourish — never
the whole table and never the per-frame game loop. Any three.js use must be:
lazy-loaded, gated behind a capability + `prefers-reduced-motion` check, and
shipped with a CSS/2D fallback.

**The rule that overrides aesthetics: mobile performance first.** No effect — CSS
or WebGL — may drop below 60fps or cause jank on a mid-range phone. If a depth
effect costs frames, simplify it; the felt and a clean chip beat a heavy scene.

---

## 5. Distinctive design principles & pitfalls

**Do**

- Keep the lamp, the rail, and the chip present — they are the identity.
- Let one signature element (the lit felt / a chip) be the memorable thing; keep
  surroundings quiet.
- Tabular mono for _all_ money; a quiet label over a loud number is the hierarchy.
- Quality floor, unannounced: responsive to mobile, visible keyboard focus,
  reduced-motion honored.

**Don't**

- No Vegas kitsch: neon, sparkles, slot-machine glow, gradients-on-everything.
- Don't gild ordinary UI — gold is money only.
- Don't let it decay into "dark panel + green accent" (an AI default). If it does,
  the rail/lamp/chip are missing.
- Don't animate layout or scatter ambient motion.
- Don't invent numbered `01/02/03` markers unless the content is truly a sequence.

---

## 6. Copy voice (interface words are design material)

- End-user language, active voice, sentence case: **"Take a seat", "Call", "Raise
  to", "All in", "Create table"**. An action keeps its name through the flow (a
  "Raise" button produces a "Raised" log line).
- Money is stated plainly: "Pot 1,250", "Your stack 3,400" — no salesmanship.
- Errors give direction in the interface's voice, never apologize or stay vague:
  "That table is full." / "No table found with that code." Empty states invite an
  action ("No one's seated yet — deal in to start.").

---

## Quick reference

Felt `#15392E` · lamp `#1B4332` · edge `#0B231C` · rail `#2A1E16` · gold `#F4C04A`
· emerald `#34D399` · ink `#EDE9E0` · danger `#E0584B`. Fonts: Sora (display) ·
Hanken Grotesk (body) · Geist Mono (money, tabular-nums). Motion: transform/opacity,
springs, reduced-motion. Depth: CSS preserve-3d by default; three.js only for one
focal moment, mobile-perf permitting.
