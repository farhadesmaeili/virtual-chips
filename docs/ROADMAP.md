# docs/ROADMAP.md — فازبندی و تسک‌بندی

> ترتیب فازها را رعایت کن. **قبل از شروع هر تسک، به کاربر اعلام کن کدام تسک را برمی‌داری** و یک feature branch بساز.
> الگوی branch: `feature/<phase>.<task>-<slug>` — مثال: `feature/1.2-side-pot-calc`.

وضعیت‌ها: `[ ]` انجام‌نشده · `[~]` در حال انجام · `[x]` انجام‌شده.

---

## Phase 0 — Foundation & Tooling

هدف: زیرساخت پروژه و GitHub آماده شود، CI سبز شود.

- [x] **0.1** init پروژه‌ی Next.js + TypeScript strict + Tailwind.
- [x] **0.2** نصب و پیکربندی ESLint + Prettier + lint-staged.
- [x] **0.3** Husky hooks: `pre-commit` (lint-staged + branch guard) و `commit-msg` (commitlint).
- [x] **0.4** ساختار پوشه‌های Clean Architecture (`src/domain|application|infrastructure|presentation`).
- [x] **0.5** پیکربندی Vitest + اولین تست دود (smoke test). _(زودتر، حین تسک 0.1 انجام شد تا CI سبز شود.)_
- [x] **0.6** بررسی و تکمیل `.github/` (CI, templates, CODEOWNERS) و سبز شدن workflow.
- [x] **0.7** `.env.example`, `README` setup section.

**Definition of Done:** `pnpm lint && pnpm typecheck && pnpm test && pnpm build` لوکال و در CI سبز.

---

## Phase 1 — Domain: Betting Engine (pure)

هدف: موتور بت طبق `docs/BETTING-ENGINE.md`، بدون هیچ I/O.

- [ ] **1.1** Entities و Value Objects: `Room`, `PlayerInHand`, `Hand`, `Pot`, `Chips`.
- [ ] **1.2** الگوریتم **Side Pot** + unit test های جامع (چند all-in، folded ها).
- [ ] **1.3** validation اکشن‌ها (`FOLD/CHECK/CALL/BET/RAISE/ALL_IN`) + min-raise.
- [ ] **1.4** state machine پایان street و تعیین نوبت بعدی.
- [ ] **1.5** منطق تسویه (net, zero-sum) و تعیین برنده (uncontested + هر دو mode).
- [ ] **1.6** خطاهای دامنه‌ی typed.

**DoD:** پوشش تست بالا روی engine؛ همه‌ی مثال‌های مستند سبز.

---

## Phase 2 — Persistence & Auth

هدف: دیتابیس و احراز هویت.

- [ ] **2.1** Prisma schema: `User`, `Room`, `RoomMember`, `Game`, `Hand`, `ActionLog`, `Settlement`.
- [ ] **2.2** migration اولیه + seed توسعه.
- [ ] **2.3** Auth.js (credentials + در صورت تمایل OAuth) + session.
- [ ] **2.4** پیاده‌سازی repository ها پشت port های `application` (Dependency Inversion).

**DoD:** ساخت کاربر، login، و persist یک room تستی.

---

## Phase 3 — Real-time Gateway

هدف: Socket.io سرور-مرجع طبق `docs/REALTIME-EVENTS.md`.

- [ ] **3.1** custom server (Next + Socket.io) + auth بر روی connection.
- [ ] **3.2** lifecycle اتاق: create/join/leave + room state snapshot.
- [ ] **3.3** هندلر اکشن بازیکن → فراخوانی use-case → broadcast state.
- [ ] **3.4** timer نوبت (deadline-based) + auto-action سرور.
- [ ] **3.5** reconnection + resync state.
- [ ] **3.6** Zod validation روی همه‌ی payload ها + rate limiting.

**DoD:** دو client هم‌زمان، اکشن‌ها لحظه‌ای sync می‌شوند؛ قطع/وصل بدون از دست رفتن state.

---

## Phase 4 — Frontend (Table UI)

هدف: میز، صندلی‌ها، کنترل اکشن‌ها، اتصال real-time.

- [ ] **4.1** صفحه‌ی Lobby (ساخت/پیوستن به room).
- [ ] **4.2** کامپوننت میز + چیدمان صندلی‌ها (responsive).
- [ ] **4.3** پنل اکشن بازیکن (fold/check/call/bet/raise/all-in) با مقادیر معتبر.
- [ ] **4.4** نمایش pot، stack ها، dealer button، نوبت فعال.
- [ ] **4.5** Zustand store + اتصال به socket events.
- [ ] **4.6** نمای بانکدار (buy-in control, end game, declare winner).

**DoD:** یک بازی کامل از create تا settle قابل انجام در UI.

---

## Phase 5 — Animations (الزامی، حرفه‌ای)

هدف: انیمیشن‌های سطح بالا با Framer Motion (`docs/ANIMATIONS.md`).

- [ ] **5.1** حرکت ژتون بازیکن→pot و pot→برنده (spring، chip stack).
- [ ] **5.2** حلقه‌ی timer (countdown ring) دور آواتار فعال.
- [ ] **5.3** transition تغییر نوبت + ورود/خروج بازیکن (`AnimatePresence`).
- [ ] **5.4** افکت برد (celebration) و dealer/blind motion.
- [ ] **5.5** احترام به `prefers-reduced-motion` + بهینه‌سازی ۶۰fps.

**DoD:** بدون jank؛ روی موبایل هم روان.

---

## Phase 6 — Banker, Settlement & History

- [ ] **6.1** هر دو mode تعیین برنده (banker / showdown-confirm).
- [ ] **6.2** صفحه‌ی تسویه‌ی پایان بازی + گزارش net.
- [ ] **6.3** صفحه‌ی تاریخچه‌ی بازی‌ها (per user).

**DoD:** نتیجه‌ی بازی در history قابل مشاهده.

---

## Phase 7 — Hardening

- [ ] **7.1** تست‌های e2e با Playwright (سناریوی کامل + all-in/side-pot).
- [ ] **7.2** مرور امنیتی طبق چک‌لیست `CLAUDE.md` (IDOR, injection, authz).
- [ ] **7.3** edge case ها: disconnect وسط نوبت، خروج بانکدار (انتقال نقش)، room خالی.
- [ ] **7.4** observability پایه (structured logging) + error boundaries.
- [ ] **7.5** Redis adapter برای Socket.io (horizontal scale) — اختیاری برای MVP.

**DoD:** آماده‌ی deploy؛ CI کامل سبز.

---

## یادداشت اجرای هر تسک

1. `git switch develop && git pull`
2. `git switch -c feature/<phase>.<task>-<slug>`
3. اعلام تسک به کاربر.
4. کار + commit های Conventional.
5. push + باز کردن PR به سمت `develop`.
6. منتظر سبز شدن CI و review.
