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

NOTE="> [!WARNING]
> **こちらは試験目的のビルドです。通常サイトの検証には[通常版](https://github.com/originator-profile/originator-profile/releases/latest)をご利用ください。**

<details>

## Download

Download from the Assets below.

- Testing Extension (Chrome) _testing_profile_web_extension-chromium-canary.zip
- Testing Extension (Firefox) _testing_profile_web_extension-firefox-desktop-canary.zip
- Extension (Chrome) profile_web_extension-chromium-canary.zip
- Extension (Firefox) profile_web_extension-firefox-desktop-canary.zip
- WordPress Plugin wordpress-ca-manager.zip

</details>"

gh release delete canary --yes --cleanup-tag 2>/dev/null || :
gh release create canary --prerelease --title "Canary Release" --notes "$NOTE" .github/dist/*
