# CLAUDE.md — Virtual Chips

> این فایل را Claude Code به‌صورت خودکار می‌خواند. قبل از هر کاری این فایل را کامل بخوان و رعایت کن.

---

## ⛔️ قوانین اجباری (MANDATORY — قبل از هر کاری)

این سه قانون **غیرقابل مذاکره** هستند. قبل از هر تغییری در کد یا هر commit:

1. **اول `git branch` بزن** و مطمئن شو روی یک branch با الگوی `feature/*` (یا `fix/*` / `chore/*`) هستی.
   - اگر روی `main` یا `develop` بودی، **بلافاصله** بایست و یک feature branch بساز:
     `git switch -c feature/<task-name>`
2. **هیچ‌وقت** مستقیم روی `develop` یا `main` کار/commit/push نکن.
3. هر commit باید روی feature branch فعلی باشد. Pre-commit hook این را enforce می‌کند (`scripts/check-branch.sh`)، ولی تو هم خودت باید چک کنی.

**Workflow هر تسک:**

```
git switch develop && git pull
git switch -c feature/<task-id>-<short-name>
# ... کار + commit های conventional ...
git push -u origin feature/<task-id>-<short-name>
# سپس Pull Request به سمت develop
```

**هر تسکی که شروع می‌کنی، اول به کاربر اعلام کن** کدام تسک از `docs/ROADMAP.md` را برمی‌داری.

---

## 🎯 پروژه چیست

**Virtual Chips** یک لایه‌ی _betting_ برای بازی‌های نوع پوکر است — **خود بازی (hand evaluation) را پیاده‌سازی نمی‌کنیم**. فقط مدیریت ژتون مجازی، نوبت‌ها، اکشن‌ها، pot و تسویه را انجام می‌دهیم.

- بازیکن‌ها یک **Room** می‌سازند و با هم بازی می‌کنند.
- هر بازیکن در نوبت خودش با **timer** اکت می‌کند: `fold` / `check` / `call` / `bet` / `raise` / `all-in`.
- یک نفر **Banker** است که buy-in ها را کنترل می‌کند و پایان بازی را اعلام می‌کند.
- برنده‌ی هر pot به دو روش مشخص می‌شود (هر دو پشتیبانی می‌شوند):
  - **Banker-declared:** بانکدار برنده را دستی اعلام می‌کند.
  - **Player-showdown:** بازیکن‌ها claim می‌کنند و بانکدار تأیید می‌کند.
- همه‌چیز **real-time** است؛ همه لحظه‌ای اتفاق‌ها را می‌بینند.
- اکانت + تاریخچه‌ی بازی‌ها ذخیره می‌شود (DB).

جزئیات منطق در `docs/BETTING-ENGINE.md` و قرارداد رویدادها در `docs/REALTIME-EVENTS.md`.

---

## 🧱 Tech Stack

| لایه         | تکنولوژی                                               |
| ------------ | ------------------------------------------------------ |
| Framework    | Next.js 14+ (App Router) + TypeScript (strict)         |
| Real-time    | Socket.io (custom server) + Redis adapter (برای scale) |
| Database     | PostgreSQL + Prisma                                    |
| Auth         | Auth.js (NextAuth)                                     |
| Validation   | Zod (schema مشترک client/server)                       |
| Client State | Zustand                                                |
| Styling      | Tailwind CSS                                           |
| Animations   | **Framer Motion** (الزامی — انیمیشن‌های حرفه‌ای)       |
| Tests        | Vitest (unit) + Playwright (e2e)                       |
| Tooling      | ESLint + Prettier + Husky + lint-staged + Commitlint   |

---

## 🏛 معماری (Clean Architecture)

وابستگی‌ها فقط رو به داخل. `domain` هیچ وابستگی به framework ندارد.

```
src/
├── domain/            # منطق خالص بازی — بدون وابستگی به Next/Socket/Prisma
│   ├── entities/      # Room, Player, Hand, Pot
│   ├── value-objects/ # Chips, Seat, Money
│   ├── engine/        # BettingEngine (state machine) + SidePot calculator
│   └── errors/        # خطاهای دامنه
├── application/       # use cases — orchestration
│   ├── use-cases/     # CreateRoom, JoinRoom, PlayerAct, BankerSettle ...
│   └── ports/         # interface های repository (Dependency Inversion)
├── infrastructure/    # پیاده‌سازی پورت‌ها
│   ├── persistence/   # Prisma repositories
│   ├── realtime/      # Socket.io gateway + handlers
│   └── auth/          # Auth.js config
└── presentation/      # Next.js (app/, components/, hooks/, stores/)
```

**اصول:**

- موتور بت (`domain/engine`) باید **pure و کاملاً قابل تست** باشد؛ ورودی state می‌گیرد، state جدید برمی‌گرداند. هیچ I/O داخلش نباشد.
- SOLID را رعایت کن؛ مخصوصاً Dependency Inversion بین `application` و `infrastructure`.
- Side-effect ها (DB, socket) فقط در لایه‌ی infrastructure.

---

## 🔐 قوانین امنیتی (در هر تسک رعایت شود)

- **Server authoritative:** هیچ‌وقت به client اعتماد نکن. تمام validation اکشن‌ها سمت سرور در موتور دامنه انجام شود. مقدار chips/pot هرگز از client گرفته نشود.
- **Authorization (IDOR/Broken Access Control):** بازیکن فقط در **نوبت خودش** و فقط برای **خودش** می‌تواند اکت کند. اکشن‌های بانکدار فقط توسط بانکدار. این‌ها در use-case ها چک شوند، نه فقط UI.
- **Auth بر روی socket:** هنگام `connection`، session/token اعتبارسنجی شود؛ اتصال ناشناس رد شود.
- **Input validation (Injection):** همه‌ی ورودی‌های socket و API با **Zod** اعتبارسنجی شوند.
- **Rate limiting:** روی اکشن‌ها و ساخت room، rate limit بگذار (anti-spam / anti-abuse).
- **Prisma** پارامتری است (ضد SQL Injection)؛ هرگز raw query با concatenation ننویس.
- **CSRF/XSS:** از escape پیش‌فرض React استفاده کن؛ `dangerouslySetInnerHTML` ممنوع مگر sanitize شده.
- secret ها فقط در `.env` (سمت سرور)؛ هیچ secret ای به bundle کلاینت نرود.

---

## ✍️ استانداردهای کد

> ## ⚠️ قانون اجباری تست (بدون استثنا)
>
> **هر کد منطقی (business logic) باید در همان PR خودش unit test داشته باشد. کد بدون تست merge نمی‌شود.** این قانون **استثنا ندارد** مگر فایل صرفاً config / types / ساختار (بدون رفتار) باشد.
>
> **قبل از پایان هر تسک، خودت چک کن:** «آیا منطق جدیدی نوشتم که تست ندارد؟» اگر بله، **قبل از گزارش به کاربر**، تست را اضافه کن.
>
> این را **هرگز فراموش نکن.**

- همه‌ی کد و کامنت‌های کد به **انگلیسی**.
- TypeScript **strict**؛ استفاده از `any` ممنوع (در صورت نیاز `unknown` + narrowing).
- error handling صریح؛ خطاهای دامنه typed باشند (`domain/errors`).
- توابع کوچک، single-responsibility، تست‌پذیر.
- Conventional Commits (نمونه: `feat(engine): add side-pot calculation`).
- هر منطق دامنه‌ای باید **unit test** داشته باشد. موتور بت = پوشش بالا.

---

## 🎬 قوانین انیمیشن (الزامی)

انیمیشن‌ها بخش جدایی‌ناپذیر محصول‌اند، نه تزئین آخر کار:

- کتابخانه: **Framer Motion**.
- موارد حداقلی که باید انیمیت شوند:
  - حرکت ژتون‌ها از بازیکن به pot و از pot به برنده (chip stack physics-like).
  - حلقه‌ی timer دور آواتار بازیکن فعال (countdown ring).
  - تغییر نوبت (highlight transition بین صندلی‌ها).
  - ورود/خروج بازیکن (`AnimatePresence`).
  - افکت برد (pot collection + celebration).
  - dealer button و blind ها با حرکت نرم.
- اصول: ۶۰fps، استفاده از `transform/opacity` (نه layout-thrash)، احترام به `prefers-reduced-motion`، spring transitions حرفه‌ای.
- جزئیات بیشتر: `docs/ANIMATIONS.md` (در فاز ۵ تکمیل می‌شود).

---

## 🗺 نقشه‌ی راه

تسک‌بندی کامل در `docs/ROADMAP.md`. ترتیب فازها را رعایت کن. قبل از شروع هر فاز، تسک‌هایش را به کاربر اعلام کن.
