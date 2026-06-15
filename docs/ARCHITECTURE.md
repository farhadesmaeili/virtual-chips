# docs/ARCHITECTURE.md — معماری

## دید کلی

Virtual Chips یک اپ **server-authoritative** و **real-time** است. تمام منطق و اعتبارسنجی بازی روی سرور انجام می‌شود؛ کلاینت فقط render و ارسال intent می‌کند.

```
┌─────────────┐    Socket.io (WS)     ┌──────────────────────────┐
│  Client(s)  │ ◄───────────────────► │   Custom Node Server     │
│ Next.js UI  │    HTTP (SSR/API)     │  Next.js + Socket.io GW  │
│ Zustand     │ ◄───────────────────► │                          │
│ FramerMotion│                       │  ┌────────────────────┐  │
└─────────────┘                       │  │ application (UC)   │  │
                                      │  │ domain (engine)    │  │
                                      │  └─────────┬──────────┘  │
                                      │            │ ports       │
                                      │  ┌─────────▼──────────┐  │
                                      │  │ infrastructure     │  │
                                      │  │ Prisma │ Redis │Auth│  │
                                      │  └─────────┬──────────┘  │
                                      └────────────┼─────────────┘
                                           ┌───────▼───────┐
                                           │ PostgreSQL    │
                                           │ Redis (pub/sub)│
                                           └───────────────┘
```

## جریان یک اکشن

1. کلاینت `player:act` را با payload (نوع اکشن + مقدار) به سرور می‌فرستد.
2. Gateway با **Zod** payload را validate و **session** را authorize می‌کند.
3. Use-case (`PlayerAct`) state فعلی Hand را از repository می‌گیرد.
4. `BettingEngine` در domain اکشن را اعمال می‌کند → state جدید یا `DomainError`.
5. state جدید persist و در ActionLog ثبت می‌شود.
6. Gateway state عمومی را به همه‌ی اعضای room **broadcast** می‌کند.
7. اگر نوبت تغییر کرد، timer جدید با `actionDeadline` ست و broadcast می‌شود.

## چرا custom server؟

Socket.io به اتصال WebSocket پایدار نیاز دارد که با Route Handler های stateless ساده نیست. یک `server.ts` سفارشی، Next.js و Socket.io را با هم بالا می‌آورد. برای scale افقی، **Redis adapter** پیام‌ها را بین instance ها همگام می‌کند.

## مرزهای لایه‌ها (وابستگی فقط رو به داخل)

- `domain` ← هیچ import از بیرون.
- `application` ← فقط `domain` + interface های port.
- `infrastructure` ← پیاده‌سازی port ها (Prisma/Socket/Auth).
- `presentation` ← فقط از طریق use-case ها / socket با backend حرف می‌زند.

## State عمومی vs خصوصی

چون اطلاعات پنهانِ کارت نداریم، تقریباً همه‌ی state عمومی است. با این حال هرگز فیلدهای داخلی (مثلاً userId خام یا session) را به‌جای داده‌ی نمایشی broadcast نکن؛ یک **public projection** از Hand بساز.
