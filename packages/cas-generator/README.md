# CAS Generator for OPCIP website

[OP-CIPサイト](https://originator-profile.org) の各ページや各コンテンツを対象とした CA ファイルを自動生成するジェネレータです。
管理者のローカル環境での使用を前提とし、 [CA の作成](https://cip.docs.originator-profile.org/studies/general-instruction/cas-setup-guide/#%E5%88%A5%E3%81%AE%E6%96%B9%E6%B3%95-cli-%E3%82%92%E4%BD%BF%E7%94%A8%E3%81%99%E3%82%8B%E6%96%B9%E6%B3%95) を自動化することを目的としています。

<img width="986" alt="Screenshot of the CAS Generator interface showing the main dashboard." src="https://github.com/user-attachments/assets/402e588c-9a4a-4c00-b23d-52ba367cd0dd" />

**現時点ではまだ開発途上中です、品質については不充分な点があることをご了承ください**

以下のような制約のもとで運用されています。

- 現在、[OP-CIP サイト](https://originator-profile.org/)の構成のみに対し、動作します
- `pnpm build` された HTML ファイル内に存在する CSS セレクタ `article [itemprop='headline'], article [itemprop='articleBody']` に対応する要素を target として CA を生成します（特定のHTMLファイルの除外機能はありません）
- HTML ドキュメント内の、ある特定のコンテンツを target として CA に含みたい場合においては、現在 img 要素のみを対象としており、 `class="target-integrity"` を img 要素に付与することで、CA target integrity に追加されます
- 手元の鍵パスや HTML の出力先、CAS ファイルの出力先などのファイルパスの指定を、.env.local ファイルで行ないます、現時点ではこの指定ができる UI は実装されていません
- エラーにおける処理やログ表示については、現在不充分です
- コードの品質チェックは充分におこなっておらず、注意してご使用ください

## Profile Registry CLI の導入

お手元の環境での作業を前提としています。[registry のリポジトリ](https://github.com/originator-profile/ca-server/tree/main/apps/registry)をご覧ください。

## ファイルパスの指定

`.env.example` を参考に、ご自身のローカルファイルパスを指定して、 `.env.local` ファイルを作成、保存してください。

## インストール

依存関係にあるパッケージのインストールを行います。

```bash
# pnpm
pnpm install
```

## ローカルでの起動

[port 3000 は他の開発用サーバーで使用しているため](https://github.com/originator-profile/profile/pull/2003#discussion_r1990418949) 4000 で起動します。
もしも他のポートで起動したい場合、[公式ドキュメント](https://nuxt.com/docs/api/nuxt-config#port)に従い変更してください。

`http://localhost:4000` で起動します。

```bash
# pnpm
pnpm dev
```

## CAサーバーとの連携

`.env.example` を参考に環境変数を設定してください。

- OIDC_TOKEN

OIDC:で始まる以下の型定義の情報を含むtoken(base64)の文字列を設定してください。
cas-generator/server/utils/oidc.ts

- CA_SERVER_URL

リソースサーバーのエンドポイントのURLを設定してください。
/caのエンドポイントです。

環境変数を設定後、管理画面のloginをクリックして、認証をします。
CAサーバーのAPIアカウントとパスワードを入力してログインしてください。

- ISSUER

OPレジストリのOP-IDを入力してください。CAのissuerの値になります。

## CASを生成するファイルを選択

`.env.example` を参考に環境変数を設定してください。

- WEBROOT_PATH: サイトのルートパスを指定します。
- VC_OUTPUT_PATH:vc-sourcesファイルを生成するパスを指定します。
- CAS_OUTPUT_PATH: casファイルを生成するパスを指定します。

各コンテンツの左に配置されているチェックボックスを選択して、必要なコンテンツのみ選択することができます。
すべてのCASを生成したい場合は、一番上のチェックボックスを選択してすべてを選択してください。

<img width="466" alt="image" src="https://github.com/user-attachments/assets/54490d4e-42f9-4e7b-b81b-cdd507d610fe" />

## Allowed URL Origins の設定

<img width="673" alt="image" src="https://github.com/user-attachments/assets/77e942a6-ea4e-4c4b-b638-83f2d9f90afa" />

もしも Allowed URL を追加したい場合、「Settings」から入力してください。

## CAS ファイルを生成

アプリケーションが起動したら自動的に、各HTMLファイルの情報を抽出した JSON ファイルが作成されます。
「生成開始」ボタンを押すと、 ハッシュ化された"eyJ”から始まる文字列が含まれたファイルが生成され、これが実際に公開用 CAS となります。
