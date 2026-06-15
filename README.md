# 🎰 Virtual Chips

یک لایه‌ی **betting مجازی** برای بازی‌های نوع پوکر. بازیکن‌ها با ژتون مجازی، در یک room، به‌صورت real-time و با timer نوبت بازی می‌کنند. یک نفر **banker** خریدها را کنترل و پایان بازی را اعلام می‌کند، سپس برد/باخت‌ها محاسبه می‌شود.

> **خود بازی (ارزیابی دست) پیاده‌سازی نمی‌شود** — فقط مدیریت ژتون، نوبت، اکشن‌ها، pot و تسویه.

## ✨ قابلیت‌ها

- ساخت/پیوستن به room
- اکشن‌ها: fold / check / call / bet / raise / all-in
- timer نوبت با auto-action
- محاسبه‌ی main pot و **side pots** (all-in)
- دو حالت تعیین برنده: **banker-declared** و **player-showdown**
- real-time برای همه‌ی اعضا
- اکانت + تاریخچه‌ی بازی‌ها
- انیمیشن‌های حرفه‌ای (Framer Motion)

## 🧱 Stack

Next.js · TypeScript · Socket.io · PostgreSQL/Prisma · Auth.js · Zod · Zustand · Tailwind · Framer Motion · Vitest/Playwright

## 📚 مستندات

- `CLAUDE.md` — قوانین و context برای Claude Code (**اول این را بخوان**)
- `docs/ARCHITECTURE.md` — معماری
- `docs/BETTING-ENGINE.md` — منطق دقیق موتور بت (side pots و ...)
- `docs/REALTIME-EVENTS.md` — قرارداد socket
- `docs/ROADMAP.md` — فازبندی و تسک‌ها
- `CONTRIBUTING.md` — قوانین git و branching

## 🚀 راه‌اندازی (Setup)

**پیش‌نیازها:** Node `20` (طبق `.nvmrc`) · pnpm `9` · PostgreSQL · (اختیاری) Redis.
اگر pnpm نداری، با corepack فعالش کن: `corepack enable && corepack prepare pnpm@9 --activate`.

```bash
# ۱) نصب وابستگی‌ها
pnpm install

# ۲) متغیرهای محیطی — کپی کن و مقادیر را پر کن (حداقل DATABASE_URL)
cp .env.example .env

# ۳) تولید Prisma client
pnpm prisma:generate

# ۴) اجرای اپ به‌صورت لوکال  →  http://localhost:3000
npx next dev
```

> ⚠️ **نکته‌ی مهم:** اسکریپت `pnpm dev` به یک `server.ts` سفارشی (Next + Socket.io) اشاره می‌کند که **تا Phase 3 ساخته نشده**. تا آن‌موقع برای اجرای لوکال از `npx next dev` استفاده کن. در Phase 3، `server.ts` اضافه و `pnpm dev`/`pnpm start` فعال می‌شوند.

## 🐳 راه‌اندازی دیتابیس با Docker

برای توسعه‌ی لوکال، PostgreSQL (و Redis برای فاز ۳) با Docker بالا می‌آید:

```bash
docker compose up -d      # postgres روی 5433 (host)، redis روی 6379
docker compose ps         # وضعیت + healthcheck
docker compose down       # توقف (داده در volume می‌ماند)
docker compose down -v    # توقف + پاک‌کردن داده‌ی دیتابیس
```

مقادیر سرویس postgres با `DATABASE_URL` در `.env.example` هماهنگ است
(`postgres:postgres@localhost:5433/virtual_chips`). پورت میزبان عمداً
`5433` است تا با PostgreSQL نصب‌شده‌ی محلی روی `5432` تداخل نکند.

پس از بالا آمدن دیتابیس، migration اولیه را اعمال کن:

```bash
pnpm prisma:migrate       # = prisma migrate dev  (در dev)
# یا برای اعمال migration های موجود بدون ساختن جدید:
pnpm prisma migrate deploy
```

> migration اولیه از قبل در `prisma/migrations/*_init` آماده است؛ فقط وقتی
> دیتابیس بالا باشد اعمال می‌شود.

## ⛔️ قانون طلایی Git

هرگز مستقیم روی `main`/`develop` کار نکن. همیشه `feature/*`. جزئیات در `CONTRIBUTING.md`.

## 🧪 کیفیت

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

همین زنجیره در CI (`.github/workflows/ci.yml`) هم اجرا می‌شود و مرجع نهایی است.
