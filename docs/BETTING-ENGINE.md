# docs/BETTING-ENGINE.md — مشخصات موتور بت

موتور بت قلب پروژه است. این فایل قرارداد رفتاری دقیق آن را تعریف می‌کند تا پیاده‌سازی بدون ابهام انجام شود. موتور باید **pure** باشد: `(state, action) => newState`. هیچ I/O، تصادف، یا زمان واقعی داخلش نباشد (زمان به‌صورت ورودی tick داده می‌شود).

> ما **دست‌ها را ارزیابی نمی‌کنیم**. موتور فقط ژتون، نوبت، pot و تسویه را مدیریت می‌کند. برنده توسط انسان (banker یا showdown) تعیین می‌شود.

---

## 1) مدل State

```
Hand
├── id
├── roomId
├── street: number            // 0..N — «خیابان» بتینگ (preflop/flop/... فقط برچسب)
├── players: PlayerInHand[]
├── buttonSeat: number        // dealer button
├── currentBet: number        // بالاترین مبلغ committed در این street
├── lastRaiseSize: number     // برای محاسبه‌ی min-raise
├── actingSeat: number | null // نوبت چه کسی است
├── actionDeadline: number|null// timestamp (epoch ms) پایان نوبت
├── pots: Pot[]               // main + side pots
└── status: 'betting' | 'awaiting_showdown' | 'settled'

PlayerInHand
├── seat
├── userId
├── stack: number             // ژتون باقیمانده
├── committedThisStreet: number
├── committedTotal: number    // مجموع کل این Hand (برای side-pot)
├── state: 'active' | 'folded' | 'all_in' | 'sitting_out'
└── hasActedThisStreet: boolean

Pot
├── amount: number
└── eligibleSeats: number[]   // چه کسانی برای این pot واجد شرایط‌اند
```

---

## 2) اکشن‌ها و قوانین اعتبارسنجی

`toCall(player) = currentBet - player.committedThisStreet`

| اکشن     | شرط مجاز بودن                                                                     | اثر                                   |
| -------- | --------------------------------------------------------------------------------- | ------------------------------------- |
| `FOLD`   | همیشه (وقتی نوبت اوست)                                                            | `state='folded'`                      |
| `CHECK`  | `toCall == 0`                                                                     | فقط `hasActedThisStreet=true`         |
| `CALL`   | `toCall > 0` و `stack >= toCall`                                                  | `stack -= toCall`، اضافه به committed |
| `BET`    | `currentBet == 0` و `amount >= minBet` و `amount <= stack`                        | باز کردن بتینگ                        |
| `RAISE`  | `currentBet > 0` و raiseTo `>= currentBet + lastRaiseSize` و `<= committed+stack` | افزایش                                |
| `ALL_IN` | همیشه (وقتی نوبت اوست)                                                            | کل `stack` را commit می‌کند           |

- `minBet` = big blind (تنظیمات room).
- **Min-raise:** حداقل افزایش = اندازه‌ی آخرین bet/raise (`lastRaiseSize`). اولین bet در هر street، `lastRaiseSize = minBet`.
- اگر `stack < toCall`، بازیکن فقط می‌تواند `ALL_IN` کند (call ناقص).
- **All-in کمتر از min-raise:** action را برای کسانی که قبلاً اکت کرده‌اند **دوباره باز نمی‌کند** (قانون استاندارد پوکر). در MVP می‌توان ساده‌سازی کرد، ولی این رفتار صحیح است — در کامنت کد قید شود.

تمام این validation **سمت سرور** و در موتور انجام می‌شود. اکشن نامعتبر → `DomainError` (مثلاً `NotYourTurnError`, `InvalidRaiseError`, `InsufficientChipsError`).

---

## 3) پایان یک Street

یک street بسته می‌شود وقتی:

1. حداکثر یک بازیکن `active` باقی مانده باشد (بقیه folded/all_in) — یا —
2. همه‌ی بازیکن‌های `active`:
   - `hasActedThisStreet == true`، و
   - `committedThisStreet == currentBet` (همه برابر شده‌اند).

سپس:

- `committedThisStreet` ها صفر می‌شوند، `currentBet=0`, `lastRaiseSize=minBet`, `hasActedThisStreet=false`.
- اگر street بعدی وجود دارد → `street++` و نوبت از اولین `active` سمت چپ button.
- اگر همه‌ی street ها تمام شد یا فقط یک نفر مانده → `status` به سمت showdown/settlement می‌رود (بخش ۵).

**ترتیب نوبت:** ساعتگرد از button. بازیکن‌های `folded`/`all_in`/`sitting_out` رد می‌شوند.

---

## 4) محاسبه‌ی Side Pots (مهم‌ترین بخش)

وقتی بازیکن‌ها all-in با مبالغ مختلف می‌روند، pot به لایه‌ها شکسته می‌شود. هر بازیکن فقط برای pot هایی واجد شرایط است که در آن سهم گذاشته.

**الگوریتم (layer peeling):**

ورودی: لیست بازیکنان با `committedTotal` و این‌که folded هستند یا نه. (بازیکن folded ژتونش در pot می‌ماند ولی واجد شرایط برد نیست.)

```
1. contributions = map<seat, committedTotal>  // شامل folded ها هم
2. pots = []
3. while هر contribution مثبتی باقی است:
4.   minLevel = کوچک‌ترین مقدار مثبت در میان بازیکنان غیر-folded که هنوز سهم دارند
        (اگر فقط folded ها سهم دارند، minLevel = کوچک‌ترین سهم باقیمانده)
5.   layerAmount = 0
6.   eligible = []
7.   for each seat با contribution > 0:
8.       take = min(contribution[seat], minLevel)
9.       layerAmount += take
10.      contribution[seat] -= take
11.      if seat غیر-folded → eligible.push(seat)
12.   pots.push({ amount: layerAmount, eligibleSeats: eligible })
13. ادغام pot های با eligibleSeats یکسان (اختیاری، تمیزتر)
```

**مثال:**

- A all-in با 100، B all-in با 60، C با 200 (call تا 200).
- contributions: A=100, B=60, C=200.
- لایه‌ی ۱ (level=60): از هرکدام 60 → main pot = 180، eligible = {A,B,C}.
- باقیمانده: A=40, C=140.
- لایه‌ی ۲ (level=40): از A و C هرکدام 40 → side pot 1 = 80، eligible = {A,C}.
- باقیمانده: C=100.
- لایه‌ی ۳: فقط C، 100 → side pot 2 = 100، eligible = {C} (به C برمی‌گردد — uncontested).

نتیجه: main=180 (A,B,C) ، side1=80 (A,C) ، side2=100 (C).

> این الگوریتم باید با unit test های متعدد (شامل چند all-in هم‌زمان و folded ها) پوشش داده شود.

---

## 5) تعیین برنده و تسویه

### pot بدون رقیب (uncontested)

اگر در یک pot فقط یک بازیکن `eligible` و غیر-folded باقی بماند → خودکار برنده است، بدون نیاز به اعلام انسانی.

### حالت A — Banker-declared

در `awaiting_showdown`، بانکدار برای **هر pot** برنده/برنده‌ها را از میان `eligibleSeats` انتخاب می‌کند. تقسیم مساوی برای split (باقیمانده‌ی تقسیم به نزدیک‌ترین بازیکن سمت چپ button — odd chip rule).

### حالت B — Player-showdown

بازیکنان `active` باقیمانده هر کدام «claim» یا «muck» می‌کنند؛ سپس **بانکدار تأیید نهایی** می‌کند (چون hand evaluation نداریم). تا قبل از تأیید بانکدار، ژتون منتقل نمی‌شود.

تنظیم `room.settlementMode: 'banker' | 'showdown'`.

### پایان بازی (Banker ends game)

بانکدار «پایان» را می‌زند:

- `net[player] = currentChips - totalBuyIn`
- مجموع net ها باید صفر باشد (zero-sum). اگر rake فعال است، از این مجموع کسر شده و گزارش می‌شود.
- نتیجه در DB ذخیره و برای history نگه‌داری می‌شود.

---

## 6) Timer نوبت

- وقتی نوبت به بازیکنی می‌رسد، سرور `actionDeadline = now + room.actionTimeoutMs` را ست و broadcast می‌کند.
- **کلاینت countdown را از روی deadline رندر می‌کند** (نه با tick پی‌درپی سرور — جلوگیری از spam).
- اگر deadline بگذرد و بازیکن اکت نکند، سرور auto-action اعمال می‌کند:
  - اگر `toCall == 0` → `CHECK`
  - در غیر این صورت → `FOLD`
- (اختیاری) Time-bank: ذخیره‌ی زمان اضافی برای هر بازیکن.
- سرور مرجع است؛ deadline سرور معتبر است، نه ساعت کلاینت.

---

## 7) خطاهای دامنه (typed)

`NotYourTurnError`, `InvalidActionError`, `InvalidRaiseError`, `InsufficientChipsError`, `NotBankerError`, `RoomFullError`, `HandNotInBettingError`. این‌ها در `domain/errors` تعریف و در گذرگاه socket به پیام کاربرپسند map می‌شوند.
