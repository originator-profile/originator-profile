#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/../../.."

mkdir -p .github/dist

cp apps/web-ext/web-ext-artifacts/*.zip packages/wordpress/dist/*.zip .github/dist/
cd .github/dist
for f in *.zip; do
  [[ $f =~ -[0-9]+\.[0-9]+\.[0-9]+\.zip$ ]] || continue
  # shellcheck disable=SC2001
  new_name=$(echo "$f" | sed 's/-[0-9]\+\.[0-9]\+\.[0-9]\+\.zip$/-canary.zip/')
  mv "$f" "$new_name"
done
cd -

gh release delete canary --yes --cleanup-tag 2>/dev/null || :
gh release create canary --prerelease --title "Canary Release" .github/dist/*
