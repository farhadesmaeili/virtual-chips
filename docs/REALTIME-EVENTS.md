# docs/REALTIME-EVENTS.md — قرارداد رویدادهای Socket

تمام payload ها با Zod اعتبارسنجی می‌شوند. نام‌گذاری: `domain:action`.

## Client → Server

| Event                  | Payload                            | Authz         | توضیح                     |
| ---------------------- | ---------------------------------- | ------------- | ------------------------- | ------------- |
| `room:create`          | `{ name, settings }`               | user          | ساخت room، کاربر = banker |
| `room:join`            | `{ roomId }`                       | user          | پیوستن (در صورت جا)       |
| `room:leave`           | `{ roomId }`                       | member        | خروج                      |
| `banker:buyin`         | `{ roomId, targetUserId, amount }` | banker        | کنترل خرید ژتون           |
| `hand:start`           | `{ roomId }`                       | banker        | شروع دست جدید             |
| `hand:advance-street`  | `{ roomId }`                       | banker        | دیل مرحله‌ی بعد (4.7)     |
| `player:act`           | `{ roomId, action, amount? }`      | acting player | اکشن بتینگ                |
| `banker:declareWinner` | `{ roomId, potId, winnerSeats[] }` | banker        | تعیین برنده‌ی pot         |
| `player:claim`         | `{ roomId, claim: 'win'            | 'muck' }`     | active player             | showdown mode |
| `banker:endGame`       | `{ roomId }`                       | banker        | پایان + تسویه             |

## Server → Client (broadcast به room)

| Event            | Payload                          | توضیح                             |
| ---------------- | -------------------------------- | --------------------------------- |
| `room:state`     | `PublicRoomState`                | snapshot کامل (هنگام join/resync) |
| `hand:state`     | `PublicHandState`                | بعد از هر تغییر                   |
| `turn:changed`   | `{ actingSeat, actionDeadline }` | شروع نوبت جدید + deadline         |
| `action:applied` | `{ seat, action, amount }`       | برای انیمیشن/لاگ                  |
| `pot:updated`    | `{ pots }`                       | تغییر pot/side-pot                |
| `hand:settled`   | `{ awards[] }`                   | نتیجه‌ی دست (برای انیمیشن برد)    |
| `game:ended`     | `{ settlement }`                 | net هر بازیکن                     |
| `error`          | `{ code, message }`              | خطای دامنه‌ی map شده              |

## اصول

- سرور همیشه **deadline (timestamp)** می‌فرستد، نه شمارش معکوس tick-by-tick. کلاینت countdown را خودش رندر می‌کند.
- هر اتصال هنگام `connection` با session احراز هویت می‌شود؛ unauthorized → disconnect.
- rate limit: حداکثر N اکشن در ثانیه برای هر socket.
- `PublicHandState` فقط projection نمایشی است؛ هیچ داده‌ی حساس داخلی broadcast نمی‌شود.
