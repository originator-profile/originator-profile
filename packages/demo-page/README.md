# demo-page

[Originator Profile](https://docs.originator-profile.org/) の OPS / CAS / Site Profile を含むデモページです。Cloudflare Workers ( https://demo.exp.originator-profile.org/ ) にデプロイされます。

## セットアップ

```bash
pnpm install
cp .env.example .env
```

`.env` に署名用秘密鍵（JWK JSON 形式）を設定してください。

| 変数名                | 対応する issuer                                     |
| --------------------- | --------------------------------------------------- |
| `SIGNING_KEY_DEMO`    | `dns:demo.exp.originator-profile.org`               |
| `SIGNING_KEY_ANOTHER` | `dns:another-originator.exp.originator-profile.org` |

鍵の生成: `pnpm opvc key-gen <output-name>`

## 開発

```bash
pnpm dev
```

http://localhost:5173/ にアクセスしてデモページを閲覧できます。

## ビルド・プレビュー

```bash
pnpm build
pnpm preview
```

http://localhost:4173/en/ もしくは http://localhost:4173/ja/ でビルド結果を確認できます。

## 署名鍵

| 環境         | 鍵の供給元         | 説明                           |
| ------------ | ------------------ | ------------------------------ |
| ローカル開発 | `.env.development` | `dns:localhost` の公開テスト鍵 |
| 本番ビルド   | `wrangler secret`  | 各 issuer の本番秘密鍵         |

本番用の署名鍵は Wrangler Secrets で設定してください:

```bash
npx wrangler secret put SIGNING_KEY_DEMO
npx wrangler secret put SIGNING_KEY_ANOTHER
```

| シークレット名        | 対応する issuer                                     |
| --------------------- | --------------------------------------------------- |
| `SIGNING_KEY_DEMO`    | `dns:demo.exp.originator-profile.org`               |
| `SIGNING_KEY_ANOTHER` | `dns:another-originator.exp.originator-profile.org` |

## デプロイ

```bash
npx wrangler login
npx wrangler whoami  # wrangler.toml の account_id と一致することを確認
npx wrangler deploy  # pnpm build 後に実行
```

## ビルド時署名

`@originator-profile/vite-plugin` がビルド時に以下を実行します:

- `sp.json` 内の未署名 WSP を署名し `/.well-known/sp.json` に出力
- HTML 内の `<script type="application/cas+json">` を署名済み CAS に変換

### Site Profile (`sp.json` → `/.well-known/sp.json`)

`sp.json` は [Site Profile](https://docs.originator-profile.org/en/opb/site-profile/) の入力ファイルです。

- `originators`: 署名済み OPS（パススルー）
- `sites`: 未署名 [UnsignedWebsiteProfile](https://github.com/originator-profile/originator-profile/blob/main/packages/model/src/unsigned-website-profile.ts) の配列（en/ja）

### Content Attestation Set (`<script type="application/cas+json">`)

各 HTML には未署名 [UnsignedContentAttestation](https://github.com/originator-profile/originator-profile/blob/main/packages/model/src/content-attestation/unsigned-content-attestation.ts) の配列が埋め込まれています。

- `image.content`: ローカル画像パス → `digestSRI` を計算
- `ExternalResourceTargetIntegrity.content`: ローカルファイルパス → `integrity` を計算
- `BasicTarget`: ビルド時に HTML DOM から `integrity` を計算

## プロジェクト構成

```
demo-page/
├── en/index.html              # 英語ページ（未署名 CAS を含む）
├── ja/index.html              # 日本語ページ（未署名 CAS を含む）
├── sp.json                    # 未署名 Site Profile（originators + sites）
├── public/
│   ├── images/                # 画像アセット
│   └── ads/                   # 広告デモ用 HTML
├── worker/index.ts            # Cloudflare Worker（言語リダイレクト、画像 CORS）
├── vite.config.js             # Vite 設定
├── wrangler.toml              # Cloudflare Workers 設定
├── .env                       # 署名鍵（gitignore）
└── .env.example               # .env のテンプレート
```
