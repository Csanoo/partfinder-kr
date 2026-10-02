#!/usr/bin/env bash
# next build 결과(standalone)를 서버에 올릴 릴리스 묶음으로 만든다 (CI 에서 실행)
#   bash deploy/build-release.sh <릴리스ID>   →  release-<릴리스ID>.tar.gz
set -euo pipefail
ID="${1:?릴리스 ID}"
[[ "$ID" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "잘못된 ID: $ID" >&2; exit 2; }
OUT="release-${ID}"
rm -rf "$OUT" && mkdir -p "$OUT/.next" "$OUT/prisma"

cp -R .next/standalone/. "$OUT/"
cp -R .next/static "$OUT/.next/static"
[[ -d public ]] && cp -R public "$OUT/public"
cp prisma/schema.prisma "$OUT/prisma/"
cp -R prisma/migrations "$OUT/prisma/migrations"
# 로컬 .env 등 비밀값이 섞여 들어가지 않게
rm -f "$OUT"/.env*
echo "$ID" > "$OUT/RELEASE"

tar -czf "${OUT}.tar.gz" -C "$OUT" .
rm -rf "$OUT"
echo "${OUT}.tar.gz ($(du -h "${OUT}.tar.gz" | cut -f1))"
