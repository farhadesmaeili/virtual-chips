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

- [x] **4.1** صفحه‌ی Lobby (ساخت/پیوستن به room).
- [x] **4.2** کامپوننت میز + چیدمان صندلی‌ها (responsive).
- [x] **4.3** پنل اکشن بازیکن (fold/check/call/bet/raise/all-in) با مقادیر معتبر. _(شامل دکمه‌ی موقت «Start hand» بانکدار و buy-in پیش‌فرض موقت `DEFAULT_BUY_IN`.)_
- [ ] **4.4** نمایش pot، stack ها، dealer button، نوبت فعال. _(عمدتاً حین 4.2/4.3 پیاده شد؛ countdown تایمر در 4.9 بررسی می‌شود.)_
- [ ] **4.5** Zustand store + اتصال به socket events. _(پایه حین 4.1–4.3 پیاده شد: `connection-store` + socket wiring.)_
- [~] **4.6** نمای بانکدار (buy-in control, end game, declare winner).
  - **بخش ۱ (انجام‌شده، merged):** declare winner + settlement — بانکدار برنده‌ی هر pot را اعلام می‌کند، chips جابه‌جا و stack نهایی در DB ذخیره می‌شود؛ دست بعدی با chips درست شروع می‌شود (`SettleHand` use-case + `updateMemberChips`).
  - **بخش ۲ (باقی‌مانده):** کنترل buy-in/rebuy واقعیِ بانکدار (جایگزینی `DEFAULT_BUY_IN` در `application/use-cases/funding.ts`؛ آن‌موقع نشستن 0 chips می‌دهد و بانکدار funding می‌کند) + end game و گزارش net (`computeNetSettlement`).

**DoD:** یک بازی کامل از create تا settle قابل انجام در UI.

---

## Phase 4 — Manual Game Flow (banker-driven)

> ادامه‌ی Phase 4 (تسک‌های 4.7–4.11). این بخش از تست دستیِ بازی بیرون آمد: چون
> **خود بازی دستی است** (بدون hand evaluation، کارت‌های فیزیکی)، pace را انسان
> کنترل می‌کند نه موتور. شامل پیشروی دستی، چرخش دست، blindها، و نمایش نوبت/تایمر.

- [ ] **4.7** پیشروی دستی street ها (banker-confirmed).
      بعد از کامل‌شدن بتینگِ هر street، بازی باید **متوقف** بماند تا بانکدار دستی
      «street بعدی» را تأیید کند (preflop→flop→turn→river). **پیشروی خودکار نداریم**؛
      زمان هر مرحله نامحدود است چون انسان کارت‌ها را فیزیکی pace می‌کند.
  - **تداخل با موتور فعلی:** در `application/use-cases/player-act.ts`، بعد از
    `applyAction` تابع `advanceHand` (`domain/engine/street.ts`) صدا زده می‌شود که
    هنگام کامل‌شدن street **خودکار** `startNextStreet` را اجرا و actor بعدی را
    می‌گذارد. این رفتار باید بشکند.
  - **تغییرات لازم:**
    - `domain/entities` (HandStatus): افزودن وضعیت `'awaiting_street'` (بتینگِ این
      street تمام شد و street های بعدی مانده) — جدا از `'awaiting_showdown'` (همه‌ی
      street ها تمام یا uncontested → settle).
    - `domain/engine/street.ts`: تفکیک `advanceHand` به‌طوری‌که هنگام **کامل‌شدنِ
      street با وجود street بعدی** به `'awaiting_street'` برود و **`startNextStreet`
      را صدا نزند**. `startNextStreet` (pure، موجود) به use-case جدید منتقل می‌شود.
      منطق uncontested → `awaiting_showdown` و pass-to-next-seat بدون تغییر می‌ماند.
    - حالت all-in: وقتی هیچ‌کس نمی‌تواند اکت کند (همه all-in)، باز هم بانکدار باید
      street-به-street تا river جلو ببرد (برای pace کردن run-out فیزیکی)، فقط بدون
      بتینگ. پس `'awaiting_street'` این حالت را هم پوشش می‌دهد (حلقه‌ی skip فعلی در
      `advanceHand` حذف/جایگزین می‌شود).
    - `application/use-cases`: use-case جدید `AdvanceStreet` (banker-only) — چک
      می‌کند requester بانکدار است و hand در `'awaiting_street'` است، سپس
      `startNextStreet` را اعمال + save می‌کند.
    - `infrastructure/realtime`: event + handler جدید (مثلاً `hand:advance-street`
      → broadcast `hand:state` + `turn:changed`)، schema با Zod؛ turn-timer در
      `'awaiting_street'` نباید بشمارد (هیچ نوبتی pending نیست).
    - `presentation`: افزودن `'awaiting_street'` به `PublicHandState.status` کلاینت؛
      کنترل بانکدارِ «Deal flop / turn / river» (لیبل بر اساس `street`)؛ نمایش حالت
      توقف به بقیه («Waiting for the banker to deal»).
  - **DoD:** بعد از پایان بتینگِ هر street بازی منتظر می‌ماند؛ فقط بانکدار street
    بعدی را شروع می‌کند؛ unit test برای گذارها (street کامل → `awaiting_street` →
    street بعدی) و authorization؛ هیچ پیشرویِ خودکاری رخ نمی‌دهد.

- [ ] **4.8** چرخه‌ی دست توسط بانکدار: تأیید پایان دست + شروع دست بعدی با چرخش dealer button.
      بعد از settle، بانکدار باید بتواند **دست بعدی** را شروع کند و **dealer button
      بچرخد** (نه ثابت).
  - **وضعیت فعلی:** `StartHand` دکمه را `Math.min(funded seats)` می‌گذارد (ثابت،
    بدون چرخش). دکمه‌ی موقت «Start hand» (4.3) فقط دست را شروع می‌کند.
  - **تغییرات لازم:**
    - `StartHand`: اگر دستِ `settled` قبلی وجود دارد، button را به اولین صندلیِ
      occupied **بعد از** button قبلی (clockwise، با wrap) بچرخان؛ در غیر این صورت
      (دست اول) رفتار فعلی.
    - تأیید پایان دست: بعد از `awaiting_showdown` و settle (settlement = 1.5/6.1)،
      گذار صریح به `settled` و آماده‌ی دست بعد.
    - UI بانکدار: «Start next hand» بعد از settle (کنار/به‌جای «Start hand»).
  - **DoD:** چند دستِ پشت‌سرهم با چرخش درست button؛ unit test برای rotation
    (occupied seats، wrap، تک‌بازیکنِ باقی‌مانده).

- [ ] **4.9** نمایش تایمر نوبت — شمارش معکوسِ زمانِ باقیمانده‌ی بازیکن فعال.
      بازیکنِ فعال باید به‌وضوح ببیند چقدر زمان برای اکت دارد. حلقه‌ی countdown دور
      آواتار (`presentation/components/seat.tsx`) ساخته شده ولی در بازی واقعی زمان
      باقیمانده را نشان نمی‌دهد.
  - **تشخیص:** ریشه‌ی نادیدنیِ اولیه همان off-by-one صندلی‌ها بود (در 4.3 رفع شد).
    حلقه فعلاً **استاتیک** است؛ هیچ شمارشی از `actionDeadline` (مطلق، از سرور 3.4 و
    رویداد `turn:changed`) توسط کلاینت مصرف نمی‌شود.
  - **کار:** یک شمارنده‌ی قابل‌مشاهده که از `actionDeadline` رانده شود (حلقه‌ای که
    پر/خالی می‌شود **یا** ثانیه‌شمار عددی)؛ مبتنی بر زمانِ مطلق نه تیکِ per-second در
    state. انیمیشنِ نرمِ حلقه می‌تواند به 5.2 موکول شود، ولی **زمانِ باقیمانده باید
    در 4.9 دیده شود**. (cross-ref: سرور 3.4، انیمیشن 5.2.)
  - **DoD:** نوبت فعال در بازی واقعی شمارشِ زمانِ باقیمانده دارد؛ سازگار با
    `prefers-reduced-motion`.

- [ ] **4.10** Blinds — تعیین SB/BB توسط بانکدار هنگام ساخت میز + پُست‌کردنِ blindها در شروع دست.
  - **وضعیت فعلی (گزارش):** blindها **واقعاً پُست نمی‌شوند**. در
    `application/use-cases/start-hand.ts`، مقدار `room.settings.bigBlind` فقط
    به‌عنوان `minBet`/`lastRaiseSize` (حداقلِ افزایشِ bet/raise) استفاده می‌شود و
    کامنتش صریحاً می‌گوید «No blinds are posted yet». یعنی دست با `currentBet=0` و
    pot خالی شروع می‌شود و هیچ‌کس مجبور به گذاشتنِ SB/BB نیست. مقادیر در schema هست
    (`smallBlind`/`bigBlind`) با پیش‌فرضِ دامنه SB=1/BB=2.
    **پلامبینگِ ست‌کردن توسط بانکدار از قبل وجود دارد** (`createRoomSchema` فیلدهای
    اختیاری `settings.smallBlind/bigBlind` را می‌پذیرد و handler + `CreateRoom` آن
    را به دامنه پاس می‌دهند) — فقط **فرمِ ساختِ میز در لابی هیچ ورودی‌ای ندارد**، پس
    عملاً همیشه پیش‌فرض‌ها اعمال می‌شوند.
  - **کار:**
    - **لابی (`presentation`):** افزودن ورودی‌های عددیِ Small blind / Big blind به
      فرمِ ساختِ میز، با اعتبارسنجی (`BB > SB > 0`، اعدادِ صحیح) و پیش‌فرضِ معقول؛
      ارسال در `settings` رویدادِ `room:create` (پلامبینگ موجود است).
    - **`StartHand`:** پُست‌کردنِ blindهای اجباری در شروع دست — SB توسطِ بازیکنِ
      چپِ button و BB توسطِ بعدی؛ `currentBet=BB`، `lastRaiseSize=BB`، commit‌کردنِ
      chips و کاهشِ stack (با مدیریتِ all-in برای stackِ کوتاه)؛ اولین actor =
      چپِ BB. حالتِ heads-up (button همان SB را می‌گذارد) را جدا مدیریت کن.
    - **نمایش/تسویه:** نمایشِ SB/BB روی میز (readout)؛ chipهای blind از طریقِ
      `committedTotal` به‌صورت خودکار در settlement لحاظ می‌شوند.
  - **DoD:** بانکدار هنگامِ ساخت، SB/BB را تعیین می‌کند؛ در شروعِ هر دست blindها
    پُست می‌شوند (pot و currentBet درست)؛ unit test برای پُستِ blind، heads-up و
    all-inِ stackِ کوتاه.

- [ ] **4.11** بنرِ نوبتِ فعال در بالای میز — نمایشِ واضحِ «نوبتِ چه کسی است».
      نامِ بازیکنی که نوبتش است به‌صورت برجسته در بالای میز/صفحه دیده شود (مثلاً
      «alice to act»).
  - **کار:** از `hand.actingSeat` → نامِ memberِ متناظر؛ یک بنر/نوار بالای میز با
    هویتِ بصریِ vc-design (آرام، tote-board). حالت‌های دیگر را هم پوشش بده:
    `awaiting_street` → «Waiting for the banker to deal»، `awaiting_showdown` →
    «Showdown — banker to settle»، بدون نوبت → پیامِ مناسب. مکمّلِ تایمرِ 4.9.
  - **DoD:** در هر لحظه روشن است نوبتِ چه کسی است؛ روی موبایل هم خوانا.

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
- [ ] **6.4** Straddle (forced bet اختیاری) — **تسکِ جدا و بعدی، وابسته به 4.10**.
      بعد از پایه‌ی blindها (4.10)، امکانِ straddleِ اختیاری: بازیکنِ چپِ BB می‌تواند
      پیش از deal یک bet اجباری (معمولاً ۲×BB) بگذارد که به blindِ مؤثرِ جدید تبدیل
      می‌شود و آن بازیکن preflop آخر اکت می‌کند. اختیاری per-hand (فعال‌سازیِ
      بازیکن/بانکدار). **عمداً از blindهای پایه جدا و با اولویتِ پایین‌تر.**
  - **کار:** افزودنِ straddle به موتورِ شروعِ دست (بعد از blindها، قبل از اولین
    actor)؛ کنترلِ UI برای فعال‌سازی؛ unit test برای ترتیبِ اکت و currentBetِ مؤثر.

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
