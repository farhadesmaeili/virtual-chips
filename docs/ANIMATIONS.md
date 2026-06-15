# docs/ANIMATIONS.md — راهنمای انیمیشن (الزامی)

انیمیشن‌ها بخش اصلی تجربه‌ی محصول‌اند. کتابخانه: **Framer Motion**.

## اصول پایه
- فقط `transform` و `opacity` را انیمیت کن (نه `width/top/left`) تا compositing روی GPU بماند و jank نشود.
- spring transitions طبیعی: `type: 'spring', stiffness, damping` به‌جای easing خطی برای حرکت‌های فیزیکی.
- از `AnimatePresence` برای mount/unmount استفاده کن.
- همیشه `prefers-reduced-motion` را احترام بگذار: در این حالت انیمیشن‌ها را به fade ساده یا instant کاهش بده (`useReducedMotion`).
- هدف ۶۰fps؛ روی موبایل تست کن.

## فهرست انیمیشن‌های لازم

### 1. حرکت ژتون (Chip motion) — مهم‌ترین
- بازیکن → pot: ژتون‌ها از جلوی صندلی بازیکن به مرکز میز spring می‌شوند.
- pot → برنده: هنگام `hand:settled`، ژتون‌ها به سمت برنده پرواز می‌کنند.
- چند ژتون با `staggerChildren` برای حس stack.

### 2. حلقه‌ی Timer (Countdown ring)
- یک SVG ring دور آواتار بازیکن فعال که با `actionDeadline` پر/خالی می‌شود.
- نزدیک پایان: تغییر رنگ به قرمز + pulse ملایم.
- محاسبه از روی deadline سرور (نه tick).

### 3. تغییر نوبت
- highlight که نرم بین صندلی‌ها جابه‌جا می‌شود (`layoutId` برای shared layout animation).

### 4. ورود/خروج بازیکن
- `AnimatePresence` با scale + fade.

### 5. افکت برد (Celebration)
- برنده: glow + scale pop + (اختیاری) ذرات/کانفتی سبک.

### 6. Dealer button & blinds
- جابه‌جایی نرم button با spring در شروع هر دست.

## ساختار پیشنهادی
- یک ماژول `presentation/animations/` با variants و transition presets مشترک.
- presets: `chipFly`, `seatHighlight`, `playerEnter`, `winPulse` — تا یکدست بمانند.
