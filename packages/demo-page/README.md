# demo-page

複数のOPS/CASを含むデモページを作成します。

フレームワークとして[vite](https://vitejs.dev/)を使っています。

- 開発時は `pnpm dev` 後、 http://localhost:5173/ にアクセスすることでデモページを閲覧できます。
- サイトのビルドは `pnpm build` です。
- `pnpm preview` 後、 http://localhost:4173/en/ もしくは http://localhost:4173/ja/ にアクセスすることで、ビルドしたものを閲覧できます。
  - `pnpm preview` では、拡張機能を利用してデモページ内のコンテンツ (CAS) の検証を行えます。  
    ※ただし、SiteProfile の検証はできません。また、画像のリンク切れなどにより、本番環境との差異が生じる場合があります。
- デモページは、Cloudflareにてデプロイされています( https://demo.exp.originator-profile.org/ にて閲覧できます)。
- ./images にはデモページにて使用する画像ファイル、./public/imagaes には PA/WMPに使用した画像ファイルが格納されています。

## インストール

依存関係にあるパッケージのインストールを行います。

```bash
# pnpm
pnpm install
```

## 手動デプロイ方法

```bash
# wranglerにログインします。
npx wrangler login

# ログインしたアカウントを確認します。
npx wrangler whoami

# ./wrangler.toml の ${CF_ACCOUNT_ID}部分にデプロイしたいアカウントIDを設定します。

# デプロイします。
# ※ ./dist の内容がデプロイされますので、pnpm build 後にデプロイしてください。
npx wrangler deploy
```
