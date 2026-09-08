---
name: wordpress-base-image-update
description: packages/wordpress の Docker ベースイメージ（WordPress/PHP バージョンとダイジェスト）を手動更新するときに使う
---

# WordPress プラグインのベースイメージ更新

`packages/wordpress` の Docker ベースイメージは、サポート対象の PHP バージョン([README の「PHP のサポート方針」](../../packages/wordpress/README.md)を参照)を保つため、`renovate.json` の `packageRules` で Renovate の対象から除外されています。バージョンとダイジェストは手動で更新します。

## 手順

1. `packages/wordpress/scripts/update-base-image-digest.sh` を実行し、`Dockerfile` / `Dockerfile.dev` の `FROM` 行をタグ+ダイジェストで固定し直す。

   ```bash
   # 現在のタグのままダイジェストだけ更新
   packages/wordpress/scripts/update-base-image-digest.sh

   # WordPress や PHP のバージョンも上げる場合
   packages/wordpress/scripts/update-base-image-digest.sh wordpress:6.9.5-php8.2
   ```

   PHP バージョンを上げる場合は、README の「PHP のサポート方針」が指す下限([endoflife.date/php](https://endoflife.date/php))を下回らないことを確認する。

2. タグを変更した場合は `node scripts/update-readme-environments.ts` を実行し、README の「Verified」セクションを同期する(ダイジェストのみの更新では、この行にダイジェストは表示されないため不要)。
3. `docker compose exec -w /var/www/html/wp-content/plugins/ca-manager wordpress composer install` で `composer.json`/`composer.lock` が新しい PHP バージョンでも解決できることを確認する。
4. `composer run test`、`composer run lint`、`docker build --output=dist packages/wordpress` で動作確認する。

## なぜダイジェストを固定するか

`wordpress:6.9.4-php8.2` のようなタグはミュータブルな参照であり、再プッシュで指す内容が変わりうる。ダイジェストを固定することで、再ビルド時に取得するイメージの再現性とサプライチェーンセキュリティを担保する。
