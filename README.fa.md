<div align="center">

# 🎰 Virtual Chips

**یک لایه‌ی betting با ژتون مجازی برای بازی‌های نوع پوکر.**

[🇬🇧 English](./README.md) · 🇮🇷 فارسی

</div>

---

بازیکن‌ها به یک **room** می‌پیوندند و به‌صورت real-time بازی می‌کنند؛ هر کس در نوبت خودش و با یک timer شمارش معکوس اکت می‌کند. یک نفر **banker** است که buy-in‌ها را کنترل و پایان بازی را اعلام می‌کند؛ سپس برد/باخت با ژتون مجازی تسویه می‌شود.

> **خود بازی (ارزیابی دست) عمداً پیاده‌سازی نمی‌شود.** Virtual Chips فقط ژتون، نوبت، اکشن‌ها، pot و تسویه را مدیریت می‌کند — کارت‌ها فیزیکی‌اند و برنده را انسان تعیین می‌کند.

## ✨ قابلیت‌ها

- ساخت / پیوستن به room
- اکشن‌های بازیکن: fold / check / call / bet / raise / all-in
- timer نوبت با auto-action سمت سرور (check یا fold خودکار در صورت اتمام وقت)
- محاسبه‌ی main pot و **side pots** (all-in چندنفره، الگوریتم layer-peeling)
- دو حالت تعیین برنده: **banker-declared** و **player-showdown**
- state بلادرنگ برای همه‌ی اعضای room
- اکانت + تاریخچه‌ی بازی‌ها به‌ازای هر کاربر
- انیمیشن‌های حرفه‌ای (Framer Motion)، با پشتیبانی از `prefers-reduced-motion`

## 🧱 Stack

Next.js (App Router) · TypeScript (strict) · Socket.io · PostgreSQL / Prisma · Auth.js (NextAuth) · Zod · Zustand · Tailwind CSS · Framer Motion · Vitest / Playwright

معماری بر پایه‌ی Clean Architecture است (`domain` → `application` → `infrastructure` → `presentation`) و در سراسر پروژه server-authoritative. جزئیات در `docs/ARCHITECTURE.md`.

## 📚 مستندات

- `CLAUDE.md` — قوانین و context برای Claude Code (**اول این را بخوان**)
- `docs/ARCHITECTURE.md` — معماری
- `docs/BETTING-ENGINE.md` — منطق دقیق موتور بت (side pots، تسویه، …)
- `docs/REALTIME-EVENTS.md` — قرارداد socket
- `docs/ROADMAP.md` — فازبندی و تسک‌ها
- `CONTRIBUTING.md` — قوانین git و branching

## 🚀 راه‌اندازی

**پیش‌نیازها:** Node `20` (طبق `.nvmrc`) · pnpm `9` · Docker (برای PostgreSQL) · Redis در dev اختیاری است.

اگر pnpm نداری، با corepack فعالش کن: `corepack enable && corepack prepare pnpm@9 --activate`

```bash
# ۱) نصب وابستگی‌ها
pnpm install

# ۲) متغیرهای محیطی — کپی کن و مقادیر را پر کن (حداقل DATABASE_URL)
cp .env.example .env

# ۳) بالا آوردن دیتابیس (بخش «دیتابیس با Docker» پایین‌تر را ببین)
docker compose up -d

# ۴) تولید Prisma client و اعمال migration‌ها
pnpm prisma:generate
pnpm prisma migrate deploy

# ۵) (اختیاری) seed داده‌ی توسعه — کاربرها و یک room تستی
pnpm db:seed

# ۶) اجرای اپ  →  http://localhost:3000
pnpm dev
```

دستور `pnpm dev` سرورِ سفارشیِ Next.js + Socket.io (`server.ts`) را اجرا می‌کند که برای بازیِ real-time لازم است — یک `next dev` ساده، Next را بدونِ gateway وب‌سوکت بالا می‌آورد.

## 🐳 دیتابیس با Docker

برای توسعه‌ی لوکال، PostgreSQL (و Redis که از Phase 3 برای adapterِ مقیاس‌پذیریِ Socket.io استفاده می‌شود) با Docker بالا می‌آیند:

```bash
docker compose up -d      # postgres روی پورت میزبان 5433، redis روی 6379
docker compose ps         # وضعیت + healthcheck
docker compose down       # توقف (داده در volume می‌ماند)
docker compose down -v    # توقف + پاک‌کردن داده‌ی دیتابیس
```

سرویس postgres با `DATABASE_URL` در `.env.example` هماهنگ است (`postgres:postgres@localhost:5433/virtual_chips`). پورت میزبان `5433` عمدی است تا با PostgreSQL نصب‌شده‌ی محلی روی `5432` تداخل نکند.

پس از بالا آمدن دیتابیس، migration‌ها را اعمال کن:

```bash
pnpm prisma migrate deploy   # اعمال migration‌های موجود
# یا در dev، برای ساخت + اعمال یک migration جدید:
pnpm prisma:migrate          # = prisma migrate dev
```

### داده‌ی seedشده‌ی توسعه

دستور `pnpm db:seed` idempotent است و سه کاربرِ آماده‌ی لاگین می‌سازد (پسورد `password123`): `alice`، `bob`، `carol`؛ به‌علاوه‌ی یک room به نامِ «Dev Table» (`dev-room`) با alice به‌عنوان banker (SB 5 / BB 10). تا وقتی یک بازی انجام و پایان‌یافته نشود، تاریخچه برای کاربرهای seedشده خالی است.

## ⛔️ قانون طلایی Git

هرگز مستقیم روی `main` / `develop` کار نکن. همیشه از یک branch با الگوی `feature/*` استفاده کن. جزئیات در `CONTRIBUTING.md`.

## 🧪 زنجیره‌ی کیفیت

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

همین زنجیره در CI (`.github/workflows/ci.yml`) هم اجرا می‌شود و مرجع نهایی است.
