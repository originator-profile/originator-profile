# opvc - Originator Profile Verifiable Credential command line tool

Originator Profile (OP) 仕様に準拠した Verifiable Credential (VC) を作成・管理するためのツールです。

## Installation

### From source

```sh
git clone https://github.com/originator-profile/originator-profile.git
cd originator-profile/packages/opvc
pnpm install
npm i -g .
opvc
```

### Using `npx` / `npm`

```sh
# npx
npx -y @originator-profile/opvc

# npm
npm i -g @originator-profile/opvc
opvc
```

## Commands

<!-- prettier-ignore-start -->
<!-- commands -->
* [`opvc ca:sign`](#opvc-casign)
* [`opvc ca:unsigned`](#opvc-caunsigned)
* [`opvc help [COMMAND]`](#opvc-help-command)
* [`opvc key-gen`](#opvc-key-gen)
* [`opvc sign`](#opvc-sign)
* [`opvc wsp:unsigned`](#opvc-wspunsigned)

## `opvc ca:sign`

Content Attestation の作成

```
USAGE
  $ opvc ca:sign -i <value> --input <filepath> [--issued-at <value>] [--expired-at <value>]

FLAGS
  -i, --identity=<value>    (required) プライベート鍵のファイルパス
      --expired-at=<value>  有効期限 (ISO 8601)
      --input=<filepath>    (required) 入力ファイルのパス (JSON 形式)
      --issued-at=<value>   発行日時 (ISO 8601)

DESCRIPTION
  Content Attestation の作成

  標準出力に Content Attestation を出力します。

EXAMPLES
  $ opvc ca:sign \
      -i account-key.example.priv.json \
      --input article-content-attestation.example.json

FLAG DESCRIPTIONS
  -i, --identity=<value>  プライベート鍵のファイルパス

    プライベート鍵のファイルパスを渡してください。プライベート鍵は JWK 形式か、PEM base64 でエンコードされた PKCS #8
    形式にしてください。

  --expired-at=<value>  有効期限 (ISO 8601)

    日付のみの場合、その日の 24:00:00.000 より前まで有効、それ以外の場合、期限切れとなる日付・時刻・秒を指定します。

  --input=<filepath>  入力ファイルのパス (JSON 形式)

    Article Content Attestation の例:

    {
    "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://originator-profile.org/ns/credentials/v1",
    "https://originator-profile.org/ns/cip/v1",
    {
    "@language": "ja"
    }
    ],
    "type": [
    "VerifiableCredential",
    "ContentAttestation"
    ],
    "issuer": "dns:example.com",
    "credentialSubject": {
    "id": "urn:uuid:78550fa7-f846-4e0f-ad5c-8d34461cb95b",
    "type": "Article",
    "headline": "<Webページのタイトル>",
    "image": {
    "id": "<サムネイル画像URL>",
    "content": [
    "<コンテンツ (data:// 形式URL)>"
    ]
    },
    "description": "<Webページの説明>",
    "author": [
    "山田花子"
    ],
    "editor": [
    "山田太郎"
    ],
    "datePublished": "2023-07-04T19:14:00Z",
    "dateModified": "2023-07-04T19:14:00Z",
    "genre": "Arts & Entertainment"
    },
    "allowedUrl": "https://media.example.com/articles/2024-06-30",
    "target": [
    {
    "type": "<Target Integrityの種別>",
    "content": [
    "<コンテンツ本体 (text/html or URL)>"
    ],
    "cssSelector": "<CSS セレクター (optional)>"
    }
    ]
    }
```

_See code: [src/commands/ca/sign.ts](https://github.com/originator-profile/originator-profile/blob/v0.6.0-beta.0/packages/opvc/src/commands/ca/sign.ts)_

## `opvc ca:unsigned`

未署名 Content Attestation の取得

```
USAGE
  $ opvc ca:unsigned --input <filepath> [--issued-at <value>] [--expired-at <value>]

FLAGS
  --expired-at=<value>  有効期限 (ISO 8601)
  --input=<filepath>    (required) 入力ファイルのパス (JSON 形式)
  --issued-at=<value>   発行日時 (ISO 8601)

DESCRIPTION
  未署名 Content Attestation の取得

  標準出力に未署名 Content Attestation を出力します。
  target[].integrity を省略した場合、type に準じて content から integrity を計算します。
  一方、target[].integrity が含まれる場合、その値をそのまま使用します。
  なお、いずれも target[].content プロパティが削除される点にご注意ください。
  これにより入力ファイルの target[] と異なる結果が含まれますが、これは正しい動作です。

EXAMPLES
  $ opvc ca:unsigned \
      --input article-content-attestation.example.json

FLAG DESCRIPTIONS
  --expired-at=<value>  有効期限 (ISO 8601)

    日付のみの場合、その日の 24:00:00.000 より前まで有効、それ以外の場合、期限切れとなる日付・時刻・秒を指定します。

  --input=<filepath>  入力ファイルのパス (JSON 形式)

    Article Content Attestation の例:

    {
    "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://originator-profile.org/ns/credentials/v1",
    "https://originator-profile.org/ns/cip/v1",
    {
    "@language": "<言語・地域コード>"
    }
    ],
    "type": [
    "VerifiableCredential",
    "ContentAttestation"
    ],
    "issuer": "<OP ID>",
    "credentialSubject": {
    "id": "<CA ID>",
    "type": "Article",
    "headline": "<コンテンツのタイトル>",
    "description": "<コンテンツの説明>",
    "image": {
    "id": "<サムネイル画像URL>",
    "content": [
    "<コンテンツ (data:// 形式URL)>"
    ]
    },
    "datePublished": "<公開日時>",
    "dateModified": "<最終更新日時>",
    "author": [
    "<著者名>"
    ],
    "editor": [
    "<編集者名>"
    ],
    "genre": "<ジャンル>"
    },
    "allowedUrl": "<CAの使用を許可するWebページのURL Pattern>",
    "target": [
    {
    "type": "<Target Integrityの種別>",
    "content": [
    "<コンテンツ本体 (text/html or URL)>"
    ],
    "cssSelector": "<CSS セレクター (optional)>"
    }
    ]
    }
```

_See code: [src/commands/ca/unsigned.ts](https://github.com/originator-profile/originator-profile/blob/v0.6.0-beta.0/packages/opvc/src/commands/ca/unsigned.ts)_

## `opvc help [COMMAND]`

Display help for opvc.

```
USAGE
  $ opvc help [COMMAND...] [-n]

ARGUMENTS
  [COMMAND...]  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for opvc.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/6.2.42/src/commands/help.ts)_

## `opvc key-gen`

鍵ペアの生成

```
USAGE
  $ opvc key-gen -o <value>

FLAGS
  -o, --output=<value>  (required) 鍵を保存するファイル名（拡張子除く）。<output>.priv.json と <output>.pub.json
                        を出力します。

DESCRIPTION
  鍵ペアの生成
```

_See code: [src/commands/key-gen/index.ts](https://github.com/originator-profile/originator-profile/blob/v0.6.0-beta.0/packages/opvc/src/commands/key-gen/index.ts)_

## `opvc sign`

VC の作成

```
USAGE
  $ opvc sign -i <value> --input <filepath> [--id <value>] [--issued-at <value>] [--expired-at <value>]

FLAGS
  -i, --identity=<value>    (required) プライベート鍵のファイルパス
      --expired-at=<value>  有効期限 (ISO 8601)
      --id=<value>          OP ID (ドメイン名)
      --input=<filepath>    (required) 入力ファイルのパス (JSON 形式)
      --issued-at=<value>   発行日時 (ISO 8601)

DESCRIPTION
  VC の作成

  VC に署名します。
  標準出力に VC を出力します。

EXAMPLES
  $ opvc sign \
      -i example.priv.json \
      --id example.com \
      --input core-profile.json

  $ opvc sign \
      -i example.priv.json \
      --id example.org \
      --input web-media-profile.json

  $ opvc sign \
      -i account-key.example.priv.json \
      --input website-profile.example.json

FLAG DESCRIPTIONS
  -i, --identity=<value>  プライベート鍵のファイルパス

    プライベート鍵のファイルパスを渡してください。プライベート鍵は JWK 形式か、PEM base64 でエンコードされた PKCS #8
    形式にしてください。

  --expired-at=<value>  有効期限 (ISO 8601)

    日付のみの場合、その日の 24:00:00.000 より前まで有効、それ以外の場合、期限切れとなる日付・時刻・秒を指定します。

  --id=<value>  OP ID (ドメイン名)

    ドメイン名 (RFC 4501) を指定します。

  --input=<filepath>  入力ファイルのパス (JSON 形式)

    コアプロファイル (CP) の例:

    {
    "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://originator-profile.org/ns/credentials/v1"
    ],
    "type": [
    "VerifiableCredential",
    "CoreProfile"
    ],
    "issuer": "dns:example.org",
    "credentialSubject": {
    "id": "dns:example.jp",
    "type": "Core",
    "jwks": {
    "keys": [
    {
    "kid": "LIstkoCvByn4jk8oZPvigQkzTzO9UwnGnE-VMlkZvYQ",
    "kty": "EC",
    "crv": "P-256",
    "x": "QiVI-I-3gv-17KN0RFLHKh5Vj71vc75eSOkyMsxFxbE",
    "y": "bEzRDEy41bihcTnpSILImSVymTQl9BQZq36QpCpJQnI"
    }
    ]
    }
    }
    }

    ウェブメディアプロファイル (WMP) の例:

    {
    "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://originator-profile.org/ns/credentials/v1",
    "https://originator-profile.org/ns/cip/v1",
    {
    "@language": "ja"
    }
    ],
    "type": [
    "VerifiableCredential",
    "WebMediaProfile"
    ],
    "issuer": "dns:wmp-issuer.example.org",
    "credentialSubject": {
    "id": "dns:wmp-holder.example.jp",
    "type": "OnlineBusiness",
    "url": "https://www.wmp-holder.example.jp/",
    "name": "○○メディア (※開発用サンプル)",
    "logo": {
    "id": "https://www.wmp-holder.example.jp/image.png",
    "digestSRI": "sha256-Upwn7gYMuRmJlD1ZivHk876vXHzokXrwXj50VgfnMnY="
    },
    "email": "contact@wmp-holder.example.jp",
    "telephone": "0000000000",
    "contactPoint": {
    "id": "https://wmp-holder.example.jp/contact",
    "name": "お問い合わせ"
    },
    "informationTransmissionPolicy": {
    "id": "https://wmp-holder.example.jp/statement",
    "name": "情報発信ポリシー"
    },
    "publishingPrinciple": {
    "id": "https://wmp-holder.example.jp/editorial-guidelines",
    "name": "編集ガイドライン"
    },
    "privacyPolicy": {
    "id": "https://wmp-holder.example.jp/privacy",
    "name": "プライバシーポリシー"
    },
    "description": [
    {
    "encodingFormat": "text/plain",
    "text": "この文章はこの Web メディアに関する補足情報です。"
    }
    ]
    }
    }

    Website Profile (WSP) の例:

    {
    "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://originator-profile.org/ns/credentials/v1",
    "https://originator-profile.org/ns/cip/v1",
    {
    "@language": "ja"
    }
    ],
    "type": [
    "VerifiableCredential",
    "WebsiteProfile"
    ],
    "issuer": "dns:example.com",
    "credentialSubject": {
    "id": "https://media.example.com/",
    "type": "WebSite",
    "name": "<Webサイトのタイトル>",
    "description": "<Webサイトの説明>",
    "image": {
    "id": "https://media.example.com/image.png",
    "digestSRI": "sha256-Upwn7gYMuRmJlD1ZivHk876vXHzokXrwXj50VgfnMnY="
    },
    "allowedOrigin": [
    "https://media.example.com"
    ]
    }
    }
```

_See code: [src/commands/sign.ts](https://github.com/originator-profile/originator-profile/blob/v0.6.0-beta.0/packages/opvc/src/commands/sign.ts)_

## `opvc wsp:unsigned`

未署名 Website Profile の取得

```
USAGE
  $ opvc wsp:unsigned --input <filepath> [--issued-at <value>] [--expired-at <value>]

FLAGS
  --expired-at=<value>  有効期限 (ISO 8601)
  --input=<filepath>    (required) 入力ファイルのパス (JSON 形式)
  --issued-at=<value>   発行日時 (ISO 8601)

DESCRIPTION
  未署名 Website Profile の取得

  標準出力に未署名 Website Profile を出力します。

EXAMPLES
  $ opvc wsp:unsigned \
      --input website-profile.example.json

FLAG DESCRIPTIONS
  --expired-at=<value>  有効期限 (ISO 8601)

    日付のみの場合、その日の 24:00:00.000 より前まで有効、それ以外の場合、期限切れとなる日付・時刻・秒を指定します。

  --input=<filepath>  入力ファイルのパス (JSON 形式)

    Website Profile の例:

    {
    "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://originator-profile.org/ns/credentials/v1",
    "https://originator-profile.org/ns/cip/v1",
    {
    "@language": "<言語・地域コード>"
    }
    ],
    "type": [
    "VerifiableCredential",
    "WebsiteProfile"
    ],
    "issuer": "<OP ID>",
    "credentialSubject": {
    "id": "<Web サイトのオリジン (形式: https://<ホスト名>)>",
    "type": "WebSite",
    "name": "<Web サイトの名称>",
    "description": "<Web サイトの説明>",
    "image": {
    "id": "<サムネイル画像URL>",
    "content": [
    "<コンテンツ (data:// 形式URL)>"
    ]
    },
    "allowedOrigin": [
    "<Web サイトのオリジン (形式: https://<ホスト名>)>"
    ]
    }
    }
```

_See code: [src/commands/wsp/unsigned.ts](https://github.com/originator-profile/originator-profile/blob/v0.6.0-beta.0/packages/opvc/src/commands/wsp/unsigned.ts)_
<!-- commandsstop -->
<!-- prettier-ignore-end -->

## Node.js から利用する

`@originator-profile/opvc` は TypeScript/JavaScript からも利用できます。

### ローカル環境でのWebsite Profileの署名

ローカルのプライベート鍵で署名する場合は `WebsiteProfile.sign()` を使います。

```ts
import { WebsiteProfile } from "@originator-profile/opvc";

const jwt = await WebsiteProfile.sign(input, privateKey, {
  issuedAt: new Date(),
  expiredAt: "2027-03-31",
});
```

### ローカル環境でのContent Attestationの署名

ローカルのプライベート鍵で署名する場合は `ContentAttestation.sign()` を使います。

```ts
import { ContentAttestation } from "@originator-profile/opvc";

const jwt = await ContentAttestation.sign(input, privateKey, {
  issuedAt: new Date(),
  expiredAt: "2027-03-31",
});
```

### 未署名 Content Attestation の取得

未署名の Content Attestation が必要な場合は `ContentAttestation.unsignedCa()` を使えます。

```ts
import { ContentAttestation } from "@originator-profile/opvc";

const uca = await ContentAttestation.unsignedCa(input, {
  issuedAt: new Date(),
  expiredAt: "2027-03-31",
});
```

### CA Server経由での署名

CA Server で署名する場合は `ContentAttestation.signByServer()` を使います。
内部では未署名 Content Attestation を組み立てて CA server に送信し、返却された JWT を受け取ります。

```ts
import { ContentAttestation } from "@originator-profile/opvc";

const jwt = await ContentAttestation.signByServer(input, {
  endpoint: "https://example.com/ca",
  accessToken: process.env.CA_SERVER_ACCESS_TOKEN!,
  issuedAt: new Date(),
  expiredAt: "2027-03-31",
});
```

## Development

```sh
git clone https://github.com/originator-profile/originator-profile.git
cd originator-profile/packages/opvc
pnpm install
bin/dev.ts
```
