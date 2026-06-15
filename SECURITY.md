# SECURITY — چک‌لیست امنیتی

این چک‌لیست در هر PR باید رعایت شود (مرجع: `CLAUDE.md`).

## Server-authoritative

- [ ] مقدار chips/pot هرگز از client گرفته نمی‌شود.
- [ ] تمام validation اکشن در موتور دامنه‌ی سمت سرور است.

## Authorization (IDOR / Broken Access Control)

- [ ] بازیکن فقط در نوبت خودش اکت می‌کند (`NotYourTurnError`).
- [ ] بازیکن نمی‌تواند برای کاربر دیگری اکشن بفرستد.
- [ ] اکشن‌های بانکدار فقط با نقش banker (`NotBankerError`).
- [ ] چک‌ها در use-case هستند، نه فقط در UI.

## Input validation

- [ ] همه‌ی payload های socket/API با Zod اعتبارسنجی می‌شوند.
- [ ] هیچ raw SQL با concatenation (فقط Prisma پارامتری).

## Auth & Session

- [ ] اتصال socket هنگام connection احراز هویت می‌شود.
- [ ] secret ها فقط سمت سرور (`.env`)، نه bundle کلاینت.
- [ ] password ها hash می‌شوند (هرگز plain text).

## Anti-abuse

- [ ] rate limiting روی ساخت room و اکشن‌ها.

## XSS/CSRF

- [ ] بدون `dangerouslySetInnerHTML` غیرضروری.
- [ ] CSRF protection پیش‌فرض Auth.js فعال.

## گزارش آسیب‌پذیری

آسیب‌پذیری‌ها را به‌صورت خصوصی گزارش دهید (issue عمومی نسازید).
