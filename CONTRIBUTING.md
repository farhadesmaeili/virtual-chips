# CONTRIBUTING — قوانین مشارکت

## ⛔️ قوانین اجباری Git

1. **هیچ‌وقت** مستقیم روی `main` یا `develop` کار نکن.
2. قبل از هر کار: `git branch` بزن و branch فعلی را چک کن.
3. هر تغییر روی یک **feature branch** انجام می‌شود.

Pre-commit hook (`scripts/check-branch.sh`) commit روی `main`/`develop` را مسدود می‌کند، ولی این جایگزین دقت تو نیست.

## مدل branching

```
main      ← فقط release های پایدار (محافظت‌شده)
  ▲
develop   ← شاخه‌ی یکپارچه‌سازی (محافظت‌شده)
  ▲
feature/* ← کار روزمره
fix/*     ← رفع باگ
chore/*   ← tooling/docs
```

الگوی نام: `feature/<phase>.<task>-<slug>` — مثال: `feature/3.4-turn-timer`.

## جریان کار

```bash
git switch develop && git pull
git switch -c feature/3.4-turn-timer
# ... کد + commit ...
git push -u origin feature/3.4-turn-timer
# سپس PR به سمت develop
```

## Conventional Commits

فرمت: `type(scope): subject`

types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `build`, `ci`.

مثال‌ها:

- `feat(engine): add side-pot layer peeling`
- `fix(realtime): prevent acting out of turn`
- `test(engine): cover multi all-in side pots`

commit-msg hook با commitlint این فرمت را الزام می‌کند.

## قبل از push

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

## Pull Request

- به سمت `develop` باز کن.
- قالب PR را پر کن.
- CI باید سبز باشد و حداقل یک review لازم است (طبق branch protection).
