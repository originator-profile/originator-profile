# rtb

拡張機能での RTB 記載情報と広告プロファイルの整合性の確認

[types.ts](./types.ts)

```ts
/** OP ID */
type OpId = string;

/** 広告主 */
export type Advertiser = {
  type: "advertiser";
  id?: OpId;
};

/** 広告取引記載情報 */
export type BidResponse = {
  "@context"?: string;
  bidresponse?: {
    bid?: {
      op?: Array<Advertiser>;
    };
  };
};
```

例:

```html
<!-- SSP側での広告取引記載情報・広告主の表明 -->
<script type="application/ld+json">
  {
    "@context": "https://originator-profile.org/context.jsonld",
    "bidresponse": {
      "bid": {
        "op": [
          {
            "type": "advertiser",
            "id": "ad.example.com"
          }
        ]
      }
    }
  }
</script>

<!-- DSP 側で作成した広告プロファイルをiframeによってブラウザに受け渡す -->
```

Reactコンポーネント:

```tsx
<BidResponse tabId={tabId} advertisement={ca} />
```

> **Note**\
> MV3 chrome.webNavigation, chrome.scripting API 必須

```
{
  "name": "Extension",
  "manifest_version": 3,
  "host_permissions": ["<all_urls>"],
  "permissions": ["webNavigation", "scripting"],
  ...
}
```
