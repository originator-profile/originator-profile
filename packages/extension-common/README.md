# Extension Common

ブラウザー拡張機能が共有するコードのパッケージです。

## エントリポイント

- `@originator-profile/extension-common` — 拡張機能の足回り
- `@originator-profile/extension-common/background` — Service Worker のイベント配線 (`setupBackground`)
- `@originator-profile/extension-common/content-script` — コンテンツスクリプトのハンドラ (`setupFrameHandlers` / `setupTopFrameHandlers`)
- `@originator-profile/extension-common/utils/*` — 単体で読み込むユーティリティ。副作用のみの `utils/cors-basic-auth` を含む
- `@originator-profile/extension-common/ui` — Originator Profile プロジェクトに一貫性のある見た目を提供する UI コンポーネント
- `@originator-profile/extension-common/ui/assets/*` — UI コンポーネントが使う画像

## Usage

UI コンポーネントを利用する場合、[TailwindCSS をインストール](https://tailwindcss.com/docs/installation)したのち、次のような設定をおこないます。TailwindCSS をインストールする方法の詳細は[公式ドキュメント](https://tailwindcss.com/docs/installation/)を参照してください。

```css
@import "tailwindcss";
@import "tailwind-config-originator-profile";
```
