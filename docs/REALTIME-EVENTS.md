# docs/REALTIME-EVENTS.md — قرارداد رویدادهای Socket

تمام payload ها با Zod اعتبارسنجی می‌شوند. نام‌گذاری: `domain:action`.

## Client → Server

| Event                 | Payload                            | Authz                | توضیح                                                          |
| --------------------- | ---------------------------------- | -------------------- | -------------------------------------------------------------- |
| `room:create`         | `{ name, settings }`               | user                 | ساخت room، کاربر = banker                                      |
| `room:join`           | `{ roomId }`                       | user                 | پیوستن (در صورت جا)                                            |
| `room:leave`          | `{ roomId }`                       | member               | خروج (نه وسطِ دست؛ بانکدار نه وسطِ بازی) (4.14)                |
| `room:sit-out`        | `{ roomId }`                       | member (self)        | نشستن بیرون؛ از دستِ بعد deal نمی‌شود (4.14)                   |
| `room:sit-in`         | `{ roomId }`                       | member (self)        | بازگشت؛ از دستِ بعد دوباره deal می‌شود (4.14)                  |
| `banker:buyin`        | `{ roomId, targetUserId, amount }` | banker               | کنترل خرید ژتون                                                |
| `hand:start`          | `{ roomId }`                       | banker               | شروع دست جدید                                                  |
| `hand:advance-street` | `{ roomId }`                       | banker               | دیل مرحله‌ی بعد (4.7)                                          |
| `chips:request`       | `{ roomId, amount }`               | member               | درخواست buy-in (4.15)                                          |
| `chips:approve`       | `{ roomId, requestId }`            | banker               | تأیید درخواست chips                                            |
| `chips:reject`        | `{ roomId, requestId }`            | banker               | رد درخواست chips                                               |
| `player:act`          | `{ roomId, action, amount? }`      | acting player        | اکشن بتینگ                                                     |
| `hand:settle`         | `{ roomId, declarations[][] }`     | banker               | تعیین/تأییدِ برنده‌ها + حرکتِ ژتون (mode A، و confirmِ mode B) |
| `player:claim`        | `{ roomId, claim }`                | active player (self) | showdown (mode B): claim برابرِ `'win'` یا `'muck'` (6.1)      |
| `banker:endGame`      | `{ roomId }`                       | banker               | پایان + تسویه                                                  |
| `history:mine`        | `{}`                               | user (self)          | تاریخچه‌ی بازی‌های کاربر — فقط بازی‌های پایان‌یافته (6.3)      |

## Server → Client (broadcast به room)

| Event            | Payload                                           | توضیح                                                                 |
| ---------------- | ------------------------------------------------- | --------------------------------------------------------------------- |
| `room:state`     | `PublicRoomState`                                 | snapshot کامل (هنگام join/resync)                                     |
| `hand:state`     | `PublicHandState`                                 | بعد از هر تغییر                                                       |
| `turn:changed`   | `{ actingSeat, actionDeadline }`                  | شروع نوبت جدید + deadline                                             |
| `action:applied` | `{ seat, action, amount }`                        | برای انیمیشن/لاگ                                                      |
| `pot:updated`    | `{ pots }`                                        | تغییر pot/side-pot                                                    |
| `hand:settled`   | `{ payouts: { seat, amount }[] }`                 | نتیجه‌ی دست (برای انیمیشن برد)                                        |
| `chips:requests` | `{ requests[] }`                                  | صفِ درخواست‌های buy-in (4.15)                                         |
| `game:ended`     | `{ nets: { seat, net }[], rake }`                 | net هر بازیکن (بدون userId)                                           |
| `history:mine`   | `{ games: { gameId, net, roomName, endedAt }[] }` | تاریخچه‌ی net کاربر؛ `endedAt` به‌صورت ISO string (بدون userId) (6.3) |
| `error`          | `{ code, message }`                               | خطای دامنه‌ی map شده                                                  |

## اصول

- سرور همیشه **deadline (timestamp)** می‌فرستد، نه شمارش معکوس tick-by-tick. کلاینت countdown را خودش رندر می‌کند.
- هر اتصال هنگام `connection` با session احراز هویت می‌شود؛ unauthorized → disconnect.
- rate limit: حداکثر N اکشن در ثانیه برای هر socket.
- `PublicHandState` فقط projection نمایشی است؛ هیچ داده‌ی حساس داخلی broadcast نمی‌شود.

## Player-showdown (mode B) — claim / confirm (6.1)

- در `awaiting_showdown` و وقتی `room.settlementMode === 'showdown'`، هر بازیکنِ **غیر-folded** با `player:claim` مقدارِ `'win'` یا `'muck'` را برای **خودش** اعلام می‌کند. seat/user همیشه از session گرفته می‌شود، نه از payload (ضد IDOR).
- claimها روی **state دست** ذخیره می‌شوند (یک فیلدِ additive روی هر `PlayerInHand`) و — وقتی wiring اضافه شود — به‌صورت additive داخلِ `hand:state` منتشر می‌شوند؛ پس از resync باقی می‌مانند (single source of truth در پنجره‌ی showdown).
- **تا تأییدِ بانکدار هیچ ژتونی جابه‌جا نمی‌شود.** بانکدار با همان رویدادِ `hand:settle` تأیید می‌کند (نه یک رویدادِ جدا). claimها صرفاً declarationها را از پیش پر می‌کنند (`claimsToDeclarations`)، و حرکتِ ژتون **تنها** در موتورِ `settleHand` انجام می‌شود — تنها مسیرِ award؛ هیچ مسیرِ موازی‌ای نیست (invariantهای net/zero-sumِ پایانِ بازی در 6.2 به همین وابسته‌اند).
- اگر potـی هیچ claimِ `'win'`ِ eligible نداشته باشد، در declarations به‌صورتِ `[]` در اندیسِ همان pot ظاهر می‌شود (نه حذف، نه hole). دقیقاً همان‌طور که `settleHand` «بدونِ برنده» را می‌خواند: potِ contested با `[]` هنگامِ confirm رد می‌شود («هنوز قابلِ تأیید نیست») و potِ uncontested نادیده‌اش می‌گیرد و خودکار award می‌شود. گیتِ سمتِ بانکدار (بلاک‌کردنِ confirm تا وقتی هر potِ contested یک entryِ غیرخالی دارد) در PR بعدی اعمال می‌شود.
- **اصلاحِ drift:** نسخه‌های قبلیِ این سند یک رویدادِ `banker:declareWinner` را فهرست کرده بودند؛ آن هرگز پیاده‌سازی نشد و تعیین/تأییدِ برنده — برای هر دو mode — از طریقِ `hand:settle { roomId, declarations }` انجام می‌شود.
