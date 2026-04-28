# @originator-profile/vite-plugin

[![npm version](https://img.shields.io/npm/v/@originator-profile/vite-plugin)](https://www.npmjs.com/package/@originator-profile/vite-plugin)

Vite plugin that signs [Website Profiles](https://docs.originator-profile.org/en/opb/site-profile/) (WSP) and [Content Attestations](https://docs.originator-profile.org/en/opb/content-attestation/) (CA) at build time.

```js
// vite.config.js
import { defineConfig } from "vite";
import { originatorProfile } from "@originator-profile/vite-plugin";

export default defineConfig({
  plugins: [
    originatorProfile({
      issuers: {
        "dns:example.com": import.meta.env.SIGNING_KEY,
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

### `issuers`

**Required.** A mapping of [OP ID](https://docs.originator-profile.org/en/opb/dns-uri-op-id/) to signing key. Each key must be the private key paired with the public key in the issuer's [Core Profile](https://docs.originator-profile.org/en/opb/cp/).

Values can be a JWK object or a JSON string (parsed internally).

```js
originatorProfile({
  issuers: {
    "dns:example.com": import.meta.env.SIGNING_KEY_PROD,
    "dns:localhost": import.meta.env.SIGNING_KEY_LOCAL,
  },
});
```

The plugin looks up the signing key for each WSP and CA by matching its `issuer` field against this mapping.

### `expiresIn`

Duration until signed credentials expire, relative to build time. Defaults to `"1y"`.

Accepts values like `"1y"` (1 year), `"6m"` (6 months), or `"30d"` (30 days).

### `wsp.input`

Path to the unsigned Site Profile input file, relative to the Vite project root. Defaults to `"./sp.json"`.

## WSP Signing

Place an unsigned [Site Profile](https://docs.originator-profile.org/en/opb/site-profile/) at `<root>/sp.json`. During build, the plugin signs each WSP in the `sites` array and emits the result to `/.well-known/sp.json`.

The `originators` array is passed through as-is. See the [`UnsignedWebsiteProfile` model](https://github.com/originator-profile/originator-profile/blob/main/packages/model/src/unsigned-website-profile.ts) for the schema of each entry in `sites`.

**Input** (`sp.json`):

```json
{
  "originators": [
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

**Output** (`/.well-known/sp.json`):

```json
{
  "originators": [
    {
      "core": "eyJ...",
      "annotations": ["eyJ..."],
      "media": ["eyJ..."]
    }
  ],
  "sites": ["eyJ...signed"]
}
```

## CA Signing

Embed unsigned Content Attestations in your HTML as a `<script>` element with type `application/prs.originator-profile.unsigned-cas+json`. During build, the plugin signs each CA and replaces the script with a [Content Attestation Set](https://docs.originator-profile.org/en/opb/content-attestation-set/) using the standard `application/cas+json` type, matching the [embedded method](https://docs.originator-profile.org/en/opb/link-to-html/#embedded-method) in the spec. Any pre-signed `application/cas+json` script in the page is passed through unchanged.

See the [`UnsignedContentAttestation` model](https://github.com/originator-profile/originator-profile/blob/main/packages/model/src/content-attestation/unsigned-content-attestation.ts) for the schema of each entry. The `main` property can be set on any entry to mark it as the main content attestation.

**Input** (HTML):

```html
<script type="application/prs.originator-profile.unsigned-cas+json">
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
          "type": "TextTargetIntegrity",
          "cssSelector": "#article",
          "content": "data:text/html,<article id=\"article\">...</article>"
        }
      ],
      "main": true
    }
  ]
</script>
```

**Output** (HTML):

```html
<script type="application/cas+json">
  [{ "attestation": "eyJ...signed", "main": true }]
</script>
```

Entries without `main: true` are serialized as bare JWT strings. Entries with `main: true` are serialized as `{ "attestation": "eyJ...", "main": true }`.

## Limitations

### `ExternalResourceTargetIntegrity` requires manual `integrity` attribute

When using [`ExternalResourceTargetIntegrity`](https://docs.originator-profile.org/en/opb/content-integrity-descriptor/external-resource/), verifiers [locate target elements by matching the `integrity` HTML attribute](https://docs.originator-profile.org/en/opb/content-integrity-descriptor/external-resource/#how-to-identify-element-location). This plugin computes the `integrity` value and includes it in the signed CA, but **does not** automatically add the `integrity` attribute to the corresponding HTML elements.

You must manually set the `integrity` attribute on each `<img>`, `<source>`, or other resource element to match the signed value:

```html
<img src="https://example.com/image.png" integrity="sha256-..." />
```

### `VisibleTextTargetIntegrity` may not match browser verification

[`VisibleTextTargetIntegrity`](https://docs.originator-profile.org/en/opb/content-integrity-descriptor/visible-text/) computes integrity from the "as rendered" visible text (`element.innerText`), which depends on browser layout and CSS. This plugin computes integrity at build time using a DOM parser without rendering, so the result may differ from what the browser extension calculates. Use `TextTargetIntegrity` or `HtmlTargetIntegrity` for reliable build-time integrity computation.

## License

Apache-2.0
