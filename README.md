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

```bash
# پیش‌نیاز: Node 20+, pnpm, PostgreSQL, (اختیاری) Redis
pnpm install
cp .env.example .env        # مقادیر را پر کن
pnpm prisma:generate
pnpm prisma:migrate
pnpm dev                    # http://localhost:3000
```

## ⛔️ قانون طلایی Git
هرگز مستقیم روی `main`/`develop` کار نکن. همیشه `feature/*`. جزئیات در `CONTRIBUTING.md`.

## 🧪 کیفیت
```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```
