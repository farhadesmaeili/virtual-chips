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

> 🗄 **مهاجرت دیتابیس:** schema و migration ها در **Phase 2** نهایی می‌شوند. بعد از آن، با `pnpm prisma:migrate` (یعنی `prisma migrate dev`) دیتابیس را آماده کن.

## ⛔️ قانون طلایی Git

هرگز مستقیم روی `main`/`develop` کار نکن. همیشه `feature/*`. جزئیات در `CONTRIBUTING.md`.

## 🧪 کیفیت

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

همین زنجیره در CI (`.github/workflows/ci.yml`) هم اجرا می‌شود و مرجع نهایی است.
