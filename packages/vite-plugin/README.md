# @originator-profile/vite-plugin

WSP と CA を署名するための Vite プラグインです。

```js
// vite.config.js
import { defineConfig } from "vite";
import originatorProfile from "@originator-profile/vite-plugin";

export default defineConfig({
  plugins: [
    originatorProfile({
      opId: "dns:localhost",
      wsp: {
        signingKey: import.meta.env.SIGNING_KEY,
      },
      ca: {
        signingKey: import.meta.env.SIGNING_KEY,
      },
    }),
  ],
});
```

## オプション

### opId

必須。WSP と CA の Holder となる主体の OP ID です。形式は [DNS URI OP ID](https://docs.originator-profile.org/en/opb/dns-uri-op-id/) でなければなりません。

### wsp.signingKey

必須。WSP の署名に用いる鍵です。JSON Web Key 形式です。[Core Profile](https://docs.originator-profile.org/en/opb/cp/)に含まれている公開鍵とペアでなければなりません。

### wsp.input

任意。未署名 WSP の Vite プロジェクトルートからの相対パスです。既定値は `./sp.json` です。[Site Profile](https://docs.originator-profile.org/en/opb/site-profile/)に未署名 WSP が含まれた形式でなければなりません。

### ca.signingKey

必須。CA の署名に用いる鍵です。JSON Web Key 形式です。[Core Profile](https://docs.originator-profile.org/en/opb/cp/)に含まれている公開鍵とペアでなければなりません。

## WSP の署名

`<root>/sp.json` に次のような JSON を用意すると、WSP が署名された状態で `/.well-known/sp.json` に書き出されます。

形式は [Unsigned Website Profile モデル](../model/src/unsigned-website-profile.ts)を確認してください。

```json
{
  "originators": [
    {
      "core": "eyJ...",
      "annotations": ["eyJ...", "eyJ..."],
      "media": ["eyJ..."]
    },
    {
      "core": "eyJ...",
      "annotations": ["eyJ..."],
      "media": ["eyJ..."]
    }
  ],
  "sites": [
    {
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        "https://originator-profile.org/ns/credentials/v1",
        "https://originator-profile.org/ns/cip/v1",
        { "@language": "en" }
      ],
      "type": ["VerifiableCredential", "WebsiteProfile"],
      "issuer": "dns:example.com",
      "credentialSubject": {
        "id": "https://media.example.com",
        "type": "WebSite",
        "name": "<Title of Web site>",
        "description": "<Description of Web site>",
        "image": {
          "id": "https://media.example.com/image.png"
        },
        "allowedOrigin": ["https://media.example.com"]
      }
    }
  ]
}
```

## CA の署名

[HTML に埋め込む形式](https://docs.originator-profile.org/en/opb/link-to-html/#embedded-method) で次のような JSON を用意すると、CA が署名された状態で HTML に書き出されます。

形式は [Unsigned Content Attestation モデル](../model/src/unsigned-content-attestation.ts)を確認してください。

```html
<script type="application/cas+json">
  [
    {
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        "https://originator-profile.org/ns/credentials/v1",
        "https://originator-profile.org/ns/cip/v1",
        { "@language": "en" }
      ],
      "type": ["VerifiableCredential", "ContentAttestation"],
      "issuer": "dns:example.com",
      "credentialSubject": {
        "id": "urn:uuid:78550fa7-f846-4e0f-ad5c-8d34461cb95b",
        "type": "Article",
        "headline": "<Article Title>",
        "image": {
          "id": "https://media.example.com/image.png"
        },
        "description": "<Web page description>",
        "author": ["Jane Smith"],
        "editor": ["John Smith"],
        "datePublished": "2023-07-04T19:14:00Z",
        "dateModified": "2023-07-04T19:14:00Z",
        "genre": "Arts & Entertainment"
      },
      "allowedUrl": ["https://media.example.com/articles/2024-06-30"],
      "target": [
        {
          "type": "VisibleTextTargetIntegrity",
          "cssSelector": "#target",
          "content": "data:text/html,<p id=\"target\">This is a visible text</p>"
        }
      ]
    }
  ]
</script>
```
