#!/usr/bin/env sh
# جلوگیری از commit مستقیم روی main/develop (قانون اجباری پروژه)
branch="$(git rev-parse --abbrev-ref HEAD)"

if [ "$branch" = "main" ] || [ "$branch" = "develop" ]; then
  echo "⛔️  commit مستقیم روی '$branch' ممنوع است."
  echo "    یک feature branch بساز:  git switch -c feature/<task-name>"
  exit 1
fi

echo "✅  branch فعلی: $branch"
