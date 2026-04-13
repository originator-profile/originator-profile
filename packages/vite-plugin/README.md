# @originator-profile/vite-plugin

[![npm version](https://img.shields.io/npm/v/@originator-profile/vite-plugin)](https://www.npmjs.com/package/@originator-profile/vite-plugin)

Vite plugin that signs [Website Profiles](https://docs.originator-profile.org/en/opb/site-profile/) (WSP) and [Content Attestations](https://docs.originator-profile.org/en/opb/content-attestation/) (CA) at build time.

```js
// vite.config.js
import { defineConfig } from "vite";
import originatorProfile from "@originator-profile/vite-plugin";

export default defineConfig({
  plugins: [
    originatorProfile({
      opId: "dns:example.com",
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

## Install

```bash
npm install -D @originator-profile/vite-plugin
```

## Options

### `opId`

**Required.** The [DNS URI OP ID](https://docs.originator-profile.org/en/opb/dns-uri-op-id/) of the holder that issues both WSP and CA credentials.

### `wsp.signingKey`

**Required.** A JSON Web Key used to sign the Website Profile. Must be the private key paired with the public key in your [Core Profile](https://docs.originator-profile.org/en/opb/cp/).

### `wsp.input`

Path to the unsigned WSP input file, relative to the Vite project root. Defaults to `"./sp.json"`.

### `ca.signingKey`

**Required.** A JSON Web Key used to sign Content Attestations. Must be the private key paired with the public key in your [Core Profile](https://docs.originator-profile.org/en/opb/cp/).

## WSP Signing

Place an unsigned [Site Profile](https://docs.originator-profile.org/en/opb/site-profile/) at `<root>/sp.json`. During build, the plugin signs the WSP and emits it to `/.well-known/sp.json`. See the [`UnsignedWebsiteProfile` model](https://github.com/originator-profile/originator-profile/blob/main/packages/model/src/unsigned-website-profile.ts) for the input schema.

```json
{
  "originators": [
    {
      "core": "eyJ...",
      "annotations": ["eyJ...", "eyJ..."],
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
        "id": "https://example.com",
        "type": "WebSite",
        "name": "Example Site",
        "description": "An example website",
        "image": {
          "id": "https://example.com/logo.png"
        },
        "allowedOrigin": ["https://example.com"]
      }
    }
  ]
}
```

## CA Signing

Embed unsigned Content Attestations in your HTML using the [embedded method](https://docs.originator-profile.org/en/opb/link-to-html/#embedded-method). During build, the plugin signs each CA and replaces them with signed JWTs in the output HTML. See the [`UnsignedContentAttestation` model](https://github.com/originator-profile/originator-profile/blob/main/packages/model/src/content-attestation/unsigned-content-attestation.ts) for the input schema.

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
        "headline": "Article Title",
        "image": {
          "id": "https://example.com/image.png"
        },
        "description": "Article description",
        "author": ["Jane Smith"],
        "datePublished": "2025-01-01T00:00:00Z"
      },
      "allowedUrl": ["https://example.com/articles/1"],
      "target": [
        {
          "type": "VisibleTextTargetIntegrity",
          "cssSelector": "#article",
          "content": "data:text/html,<article id=\"article\">...</article>"
        }
      ]
    }
  ]
</script>
```

## License

Apache-2.0
