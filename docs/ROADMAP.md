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

- [x] **1.1** Entities و Value Objects: `Room`, `PlayerInHand`, `Hand`, `Pot`, `Chips`.
- [x] **1.2** الگوریتم **Side Pot** + unit test های جامع (چند all-in، folded ها).
- [x] **1.3** validation اکشن‌ها (`FOLD/CHECK/CALL/BET/RAISE/ALL_IN`) + min-raise.
- [x] **1.4** state machine پایان street و تعیین نوبت بعدی.
- [x] **1.5** منطق تسویه (net, zero-sum) و تعیین برنده (uncontested + هر دو mode).
- [x] **1.6** خطاهای دامنه‌ی typed.

**DoD:** پوشش تست بالا روی engine؛ همه‌ی مثال‌های مستند سبز.

---

## Phase 2 — Persistence & Auth

هدف: دیتابیس و احراز هویت.

- [x] **2.1** Prisma schema: `User`, `Room`, `RoomMember`, `Game`, `Hand`, `ActionLog`, `Settlement`.
- [x] **2.2** migration اولیه + seed توسعه.
- [x] **2.3** Auth.js (credentials + در صورت تمایل OAuth) + session.
- [x] **2.4** پیاده‌سازی repository ها پشت port های `application` (Dependency Inversion).

**DoD:** ساخت کاربر، login، و persist یک room تستی.

---

## Phase 3 — Real-time Gateway

هدف: Socket.io سرور-مرجع طبق `docs/REALTIME-EVENTS.md`.

- [x] **3.1** custom server (Next + Socket.io) + auth بر روی connection.
- [x] **3.2** lifecycle اتاق: create/join/leave + room state snapshot.
- [x] **3.3** هندلر اکشن بازیکن → فراخوانی use-case → broadcast state.
- [x] **3.4** timer نوبت (deadline-based) + auto-action سرور.
- [x] **3.5** reconnection + resync state.
- [x] **3.6** Zod validation روی همه‌ی payload ها + rate limiting.

**DoD:** دو client هم‌زمان، اکشن‌ها لحظه‌ای sync می‌شوند؛ قطع/وصل بدون از دست رفتن state.

---

## Phase 4 — Frontend (Table UI)

هدف: میز، صندلی‌ها، کنترل اکشن‌ها، اتصال real-time.

- [x] **4.1** صفحه‌ی Lobby (ساخت/پیوستن به room).
- [x] **4.2** کامپوننت میز + چیدمان صندلی‌ها (responsive).
- [x] **4.3** پنل اکشن بازیکن (fold/check/call/bet/raise/all-in) با مقادیر معتبر. _(شامل دکمه‌ی موقت «Start hand» بانکدار و buy-in پیش‌فرض موقت `DEFAULT_BUY_IN`.)_
- [x] **4.4** نمایش pot، stack ها، dealer button، نوبت فعال. _(عمدتاً حین 4.2/4.3 پیاده شد؛ countdown تایمر در 4.9 بررسی می‌شود.)_
- [x] **4.5** Zustand store + اتصال به socket events. _(پایه حین 4.1–4.3 پیاده شد: `connection-store` + socket wiring.)_
- [~] **4.6** نمای بانکدار (buy-in control, end game, declare winner).
  - **بخش ۱ (انجام‌شده، merged):** declare winner + settlement — بانکدار برنده‌ی هر pot را اعلام می‌کند، chips جابه‌جا و stack نهایی در DB ذخیره می‌شود؛ دست بعدی با chips درست شروع می‌شود (`SettleHand` use-case + `updateMemberChips`).
  - **بخش ۲ (باقی‌مانده):** کنترل buy-in/rebuy واقعیِ بانکدار → به تسکِ **4.15
    (Chip requests / banker approval)** منتقل شد (جایگزینِ `DEFAULT_BUY_IN`). +
    end game و گزارشِ net (`computeNetSettlement`) که اینجا باقی می‌ماند.

**DoD:** یک بازی کامل از create تا settle قابل انجام در UI.

---

## Phase 4 — Manual Game Flow (banker-driven)

> ادامه‌ی Phase 4 (تسک‌های 4.7–4.15). این بخش از تست دستیِ بازی بیرون آمد: چون
> **خود بازی دستی است** (بدون hand evaluation، کارت‌های فیزیکی)، pace را انسان
> کنترل می‌کند نه موتور. شامل پیشروی دستی، چرخش دست، blindها، نمایش نوبت/تایمر،
> time bank، حضور/خروج بازیکن، و درخواست/تأییدِ chips.

- [x] **4.7** پیشروی دستی + تأییدِ هر مرحله توسط بانکدار + نمایشِ نامِ مرحله.
      بازی **مرحله‌به‌مرحله** پیش می‌رود و بانکدار باید **هر مرحله را صریح شروع کند**،
      نه فقط «street بعدی». جریان: **start hand → start flop → start turn → start
      river**. بعد از کامل‌شدنِ بتینگِ هر مرحله، بازی **متوقف** می‌ماند تا بانکدار
      مرحله‌ی بعد را تأیید کند؛ **پیشروی خودکار نداریم** و زمانِ هر مرحله نامحدود است
      (چون انسان کارت‌ها را فیزیکی pace می‌کند).
  - **نامِ مرحله روی میز:** نامِ مرحله‌ی فعلی (**preflop / flop / turn / river**)
    باید همیشه روی میز دیده شود (نه فقط شماره‌ی `street`).
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

- [x] **4.8** چرخه‌ی دست توسط بانکدار: شروع دست بعدی با چرخش dealer button. _(merged)_
      `firstButtonSeat`/`nextButtonSeat` (pure، با تست)؛ button دستِ اول کمترین
      صندلی و سپس clockwise با wrap می‌چرخد؛ دکمه‌ی بانکدار بعد از settle
      «Start next hand» می‌شود.

- [x] **4.9** نمایش تایمر نوبت — شمارش معکوسِ زمانِ باقیمانده‌ی بازیکن فعال.
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

- [x] **4.10** Blinds — تعیین SB/BB توسط بانکدار هنگام ساخت میز + پُست‌کردنِ blindها در شروع دست.
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
  - **پی‌گیری‌های UIِ پس از merge (post-merge follow-ups to 4.10):** بعد از mergeِ
    4.10 سه فیکسِ UI لازم شد (برای صداقتِ تاریخچه اینجا ثبت می‌شوند):
    - **جای‌گذاریِ readout بلایندها:** readout که در 4.10 پایین‌وسطِ felt بود روی
      آواتارِ heroِ صندلیِ ۰ می‌افتاد → به tote-boardِ مرکزی منتقل شد. فیکسِ اولیه
      روی یک branch به develop merge نشد و دوباره از طریق **PR #39** لَند شد.
    - **سرریزِ ورودی‌های بلایند در لابی:** ورودی‌های جدیدِ SB/BB در فرمِ ساختِ میز
      روی عرض‌های باریک از کارت بیرون می‌زدند → با `min-w-0`/`w-full` رفع شد
      (**PR #38**).
    - **بازبینیِ هم‌پوشانی (recheck):** تشخیص داده شد فیکسِ readout هرگز به develop
      merge نشده بود؛ روی همه‌ی state‌ها و تعدادِ صندلی‌ها دوباره verify و از طریق
      **PR #39** لَند شد.

- [x] **4.11** بنرِ نوبتِ فعال در بالای میز — نمایشِ واضحِ «نوبتِ چه کسی است».
      نامِ بازیکنی که نوبتش است به‌صورت برجسته در بالای میز/صفحه دیده شود (مثلاً
      «alice to act»).
  - **کار:** از `hand.actingSeat` → نامِ memberِ متناظر؛ یک بنر/نوار بالای میز با
    هویتِ بصریِ vc-design (آرام، tote-board). حالت‌های دیگر را هم پوشش بده:
    `awaiting_street` → «Waiting for the banker to deal»، `awaiting_showdown` →
    «Showdown — banker to settle»، بدون نوبت → پیامِ مناسب. مکمّلِ تایمرِ 4.9.
  - **DoD:** در هر لحظه روشن است نوبتِ چه کسی است؛ روی موبایل هم خوانا.

- [ ] **4.12** Time bank — درخواستِ زمانِ اضافه توسط بازیکن. **وابسته به 4.9.**
      وقتی تایمرِ نوبتِ بازیکن رو به اتمام است، بتواند **زمانِ اضافه** درخواست کند تا
      مهلتش تمدید شود (مثلِ time bank در اپ‌های پوکر).
  - **کار:**
    - **سرور (authoritative):** هر بازیکن یک بودجه‌ی زمانیِ محدود (مثلاً چند ثانیه،
      قابلِ تنظیم) دارد؛ رویدادِ socket مثلِ `turn:request-time` که `actionDeadline`
      را تمدید و بودجه را کم می‌کند؛ اعتبارسنجی با Zod (فقط بازیکنِ صاحبِ نوبت، فقط
      اگر بودجه دارد). turn-timer سرور بر اساسِ deadlineِ جدید reschedule شود.
    - **کلاینت:** دکمه‌ی «Add time» نزدیکِ پنل اکشن وقتی نوبتِ خودت است و زمان کم
      است؛ نمایشِ بودجه‌ی باقیمانده.
  - **DoD:** بازیکن می‌تواند نوبتش را تمدید کند؛ بودجه محترم شمرده می‌شود؛ unit test
    برای تمدید و اتمامِ بودجه. (cross-ref: 4.9 تایمر، 3.4 turn-timer سرور.)

- [ ] **4.13** لابی «میزِ فعالِ تو» — بازگشتِ سریع به میزی که سرِ آن نشسته‌ای.
      وقتی بازیکن به لابی برمی‌گردد، باید ببیند هم‌اکنون عضوِ کدام میز است و با یک
      کلیک به آن برگردد (به‌جای واردکردنِ دوباره‌ی کد).
  - **یادآوری:** این دقیقاً همان قابلیتی است که کاربر درخواست کرد (بازگشتِ سریع به
    میزِ فعال از لابی) — از قبل یک تسکِ برنامه‌ریزی‌شده است، نه چیزِ جدید.
  - **وضعیت فعلی:** عضویت در DB ماندگار است؛ ورودِ دوباره با کد در لابی به‌درستی به
    میز می‌برد (منطقِ `ALREADY_IN_ROOM` → ریدایرکت)، ولی هیچ نمایشی از «میزِ فعالِ
    تو» وجود ندارد.
  - **کار:**
    - **سرور/use-case:** راهی برای یافتنِ میز(ها)یی که کاربر در آن‌ها member است
      (مثلاً `listRoomsForUser(userId)` در repository + use-case/رویدادِ لابی).
    - **لابی (`presentation`):** کارتِ «Your table» با نامِ میز + دکمه‌ی «Rejoin»
      (مسیر `/room/<id>`). اگر عضوِ هیچ میزی نیست، چیزی نشان نده.
  - **DoD:** بازیکن میزِ فعالش را در لابی می‌بیند و با یک کلیک برمی‌گردد.

- [x] **4.14** Sit out / Leave — تکمیلِ «Leave room»ِ ناقصِ فعلی.
  - **Sit out:** رد کردنِ موقتِ دست‌ها با حفظِ صندلی؛ بازیکنِ sitting-out در شروعِ
    دست deal نمی‌شود ولی صندلی و chipsش می‌ماند و می‌تواند برگردد (sit in).
    وضعیتِ `'sitting_out'` در `PlayerState` از قبل وجود دارد؛ باید در lifecycle و UI
    سیم‌کشی شود.
  - **Leave:** خروجِ کاملِ بازیکن از میز و **آزادشدنِ صندلی** (`removeMember` موجود
    است؛ use-case `LeaveRoom` هم هست ولی در UI کامل وصل نیست). اگر بازیکن وسطِ دست
    leave کند، مثلِ fold رفتار شود.
  - **کار:**
    - **سرور:** رویداد/handlerهای `room:sit-out` / `room:sit-in` / `room:leave`
      (با Zod + authz)؛ اعمال در lifecycle (deal فقط بازیکنانِ نشسته‌ی فعال).
    - **کلاینت:** دکمه‌های Sit out / Sit in / Leave در نمای میز؛ نمایشِ وضعیتِ
      sitting-out روی صندلی.
  - **DoD:** sit out/in بدون از دست رفتنِ صندلی؛ leave صندلی را آزاد می‌کند؛
    رفتارِ درست هنگامِ leaveِ وسطِ دست. (cross-ref: edge-case های 7.3 — خروجِ بانکدار.)

- [x] **4.15** Chip requests / banker buy-in approval — **تکمیلِ بخشِ buy-inِ تسکِ 4.6**.
      جایگزینِ `DEFAULT_BUY_IN`ِ موقت. بازیکن **درخواستِ chips** می‌دهد؛ بانکدار
      تأیید/رد می‌کند؛ chipsِ تأییدشده به stackِ بازیکن اضافه و `buyInTotal` به‌روز
      می‌شود (برای محاسبه‌ی net در 6.2). **یک قابلیتِ هسته‌ایِ بانکدار.**
  - **وضعیت فعلی:** نشستن از طریقِ `DEFAULT_BUY_IN` (در `application/use-cases/
funding.ts`) به‌صورت موقت chips می‌دهد. باید با جریانِ درخواست/تأیید جایگزین شود؛
    آن‌موقع نشستن باید 0 chips بدهد.
  - **کار:**
    - **سرور/use-case:** `RequestChips` (بازیکن) و `ApproveChips`/`DenyChips`
      (banker-only)؛ افزودنِ chips به member و افزایشِ `buyInTotal` (متدِ repository
      مثلِ `addMemberChips`/`updateMemberFunding`)؛ رویدادهای socket + Zod + authz؛
      broadcastِ `room:state` به‌روز و یک صفِ درخواست‌ها به بانکدار.
    - **کلاینت:** دکمه‌ی «Request chips» برای بازیکن؛ صفِ تأیید برای بانکدار (لیستِ
      درخواست‌ها با Approve/Deny)؛ حذفِ اتکا به `DEFAULT_BUY_IN`.
  - **DoD:** بازیکن می‌تواند chips بخواهد و بانکدار تأیید کند؛ stack و buyInTotal
    درست به‌روز می‌شوند؛ نشستن دیگر chipِ خودکار نمی‌دهد؛ unit test برای approve/deny
    و به‌روزرسانیِ funding. (cross-ref: 4.6 بخش ۲، 6.2 گزارشِ net.)

- [ ] **4.16** Action menu — یک دکمه‌ی واحد که منویی از اکشن‌های بازیکن را باز
      می‌کند به‌جای پخش‌شدنِ دکمه‌ها در نمای میز. **وابسته به 4.14 و 4.15؛ بعد از
      4.14 بیاید.**
  - **کار:**
    - **بازیکن:** یک دکمه که منویی شامل request chips (4.15)، sit out / sit in و
      leave (4.14) را جمع می‌کند.
    - **بانکدار (variant):** همان منو با کنترل‌های بانکدار (مثلاً deal/advance،
      settle، تأیید/ردِ درخواست‌های chips) در یک جای واحد.
  - **وابستگی:** به handler/UIِ sit-out/leave از **4.14** و request-chips از
    **4.15** متکی است؛ بنابراین باید **بعد از 4.14** انجام شود. presentation محور
    (بدون منطقِ دامنه‌ی جدید).
  - **DoD:** یک دکمه/منوی واحد همه‌ی اکشن‌های بازیکن را عرضه می‌کند؛ نسخه‌ی بانکدار
    کنترل‌های بانکدار را نشان می‌دهد؛ روی موبایل خوانا و دسترس‌پذیر.

- [ ] **4.17** Room id UX — نمایشِ کوتاه‌شده‌ی شناسه‌ی میز با دکمه‌ی copy. مستقل از
      بقیه‌ی تسک‌ها.
  - **کار:** در نمای میز (`room-view`)، شناسه‌ی میز را به‌صورت کوتاه‌شده نشان بده
    (مثلاً چند کاراکترِ اول + «…») همراه با یک دکمه‌ی copy که **شناسه‌ی کامل** را در
    clipboard کپی می‌کند.
  - **محدوده:** فقط presentation — بدونِ تغییر در schema یا join-code؛ مقدارِ واقعیِ
    شناسه دست‌نخورده می‌ماند و فقط نمایشش کوتاه می‌شود.
  - **DoD:** شناسه‌ی کوتاه‌شده دیده می‌شود؛ copy شناسه‌ی کامل را کپی می‌کند؛ بازخوردِ
    کوتاهِ «copied»؛ روی موبایل هم کار می‌کند.

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
- [ ] **6.5** «Deal» — _placeholder، تعریف‌نشده._ یک آیتمِ آینده برای کارت‌ها/deal
      است که هنوز محدوده‌اش مشخص نیست. فعلاً فقط ثبت می‌شود تا فراموش نشود؛ قبل از
      شروع باید به یک تسکِ مشخص با دامنه تبدیل شود. (یادآوری: محصول عمداً hand
      evaluation ندارد و کارت‌ها فیزیکی‌اند — این آیتم باید با آن سازگار بماند.)

**DoD:** نتیجه‌ی بازی در history قابل مشاهده.

---

## Phase 7 — Hardening

- [ ] **7.1** تست‌های e2e با Playwright (سناریوی کامل + all-in/side-pot).
- [ ] **7.2** مرور امنیتی طبق چک‌لیست `CLAUDE.md` (IDOR, injection, authz).
- [ ] **7.3** edge case ها: disconnect وسط نوبت، خروج بانکدار (انتقال نقش)، room خالی.
  - **یادداشت (وابستگی):** قیدِ موقتِ فعلیِ «بانکدار تا `status==='playing'`
    نمی‌تواند leave کند» یک stopgap است و به **7.6** (banker-as-non-seated-manager) +
    انتقالِ نقشِ همین تسک وابسته است؛ هنگامِ کار روی 7.3/7.6 باید بازنگری شود.
- [ ] **7.4** observability پایه (structured logging) + error boundaries.
- [ ] **7.5** Redis adapter برای Socket.io (horizontal scale) — اختیاری برای MVP.

- [ ] **7.6** Banker as non-seated manager — بانکدار الزاماً سرِ میز نمی‌نشیند؛
      می‌تواند صرفاً **مدیرِ روم/بازی** باشد (بدون صندلی/stack). **تغییرِ مدلِ
      membership**، وابسته به 7.3 و با اولویتِ بعد از تثبیتِ Phase 4.
  - **انگیزه:** نقشِ بانکدار (کنترلِ buy-in، deal/advance، settle، پایانِ بازی)
    مستقل از شرکتِ او در دستِ جاری است. الان یک فرضِ ضمنی داریم که بانکدار یک
    بازیکنِ نشسته است؛ این فرض باید بشکند.
  - **اثر:**
    - `membership/lifecycle`: یک member می‌تواند banker باشد بدون seat/stack؛ در
      شروعِ دست deal نشود و در ترتیبِ نوبت و محاسبه‌ی side-pot لحاظ نشود.
    - قیدِ موقتِ banker-leave (بانکدار تا `status==='playing'` نمی‌تواند leave کند)
      با این مدلِ جدید بازنگری می‌شود.
    - `presentation`: نمای «managerِ بدونِ صندلی» جدا از نشستن سرِ میز.
  - **کار (طرحِ اولیه — قبل از شروع به تسکِ دقیق با دامنه تبدیل شود):** نقشِ
    `banker` مستقل از `seat` در مدلِ membership؛ بازبینیِ lifecycleِ deal/نوبت برای
    رد کردنِ بانکدارِ غیرنشسته؛ هماهنگی با انتقالِ نقش در 7.3.
  - **DoD:** بانکدار می‌تواند بدونِ نشستن سرِ میز بازی را مدیریت کند؛ deal/نوبت/
    side-pot او را نادیده می‌گیرند؛ قیدِ banker-leave مطابقِ مدلِ جدید بازنگری شده.

**DoD:** آماده‌ی deploy؛ CI کامل سبز.

---

## یادداشت اجرای هر تسک

1. `git switch develop && git pull`
2. `git switch -c feature/<phase>.<task>-<slug>`
3. اعلام تسک به کاربر.
4. کار + commit های Conventional.
5. push + باز کردن PR به سمت `develop`.
6. منتظر سبز شدن CI و review.
