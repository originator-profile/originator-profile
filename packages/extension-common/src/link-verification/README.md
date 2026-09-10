# link-verification

広告のリンク先が、その広告の宣言する発信者のサイトかを確認する

広告に「遷移先はこの OP」と書かせ、遷移が完了した時点で遷移先サイトが署名で証明する
OP ID と突き合わせる。一致しなければ警告ページへ差し替える。

## 設置する側

### 広告

広告に 3 つを設置する。

```html
<!-- 遷移先として宣言する OP ID -->
<script type="application/opmeta+json">
  { "targetopid": "dns:advertiser.example" }
</script>

<!-- 広告主・媒体社の Originator Profile Set -->
<script type="application/ops+json">
  [{ "core": "eyJ...", "media": ["eyJ...", "eyJ..."] }]
</script>

<!-- 広告であることの Content Attestation Set -->
<script type="application/cas+json">
  ["eyJ..."]
</script>

<a href="https://advertiser.example/lp" target="_top">広告</a>
```

CAS のうち `credentialSubject.type` が `OnlineAd` または `Advertorial` のものを
広告 CA として扱い、その `issuer` を広告主の OP ID とする。

> **Note**\
> CAS は複数の CA を置けるが、広告 1 つにつき広告 CA は 1 つを想定している。
> [detect-ad-click.ts](./detect-ad-click.ts) の `getAdCaIssuer` は先頭の広告 CA で
> 打ち切る。

### 遷移先サイト

遷移先が Site Profile (`sp.json`) を設置し、その Website Profile の `issuer` が
自身の OP ID になる。**署名の検証を通過した Website Profile だけを照合に使う。**
未署名の `sp.json` で `matched` を作れてしまうため
([verification.ts](./verification.ts))。

## 判定

| status         | 意味                                                |
| -------------- | --------------------------------------------------- |
| `matched`      | 検証済み WSP の `issuer` が `targetopid` と一致した |
| `mismatched`   | 検証は通ったが一致しない                            |
| `missing_opid` | 遷移先に Site Profile がない                        |
| `error`        | Site Profile の検証に失敗した                       |
| `none`         | まだ検証していない                                  |

照合は [matching.ts](./matching.ts) の `isMatched` が
`sites.some((wsp) => wsp.issuer === expectedOpId)` でおこなう。

## 扱う 3 つの組織

いずれも `OrgRef { id, name }`。`id` は OP ID、`name` は Web Media Profile から
解決した組織名で、解決できなければ `undefined`。

| 値                 | 何者か                           | 出所                                                                | 署名検証 |
| ------------------ | -------------------------------- | ------------------------------------------------------------------- | -------- |
| `source`           | リンク元コンテンツを表明した組織 | リンク元の OPS のうち、広告 CA の issuer に対応する WMP             | **なし** |
| `expectedOperator` | `targetopid` が表明する運営者    | リンク元の OPS のうち、`targetopid` に対応する WMP                  | **なし** |
| `actualOperator` | 実際にサイトを運営している組織   | 遷移先の検証済み Website Profile の `issuer` と、それに対応する WMP | あり     |

**判定に使うのは `expectedOperator.id` と `actualOperator.id` だけ**である。
組織名は警告ページと詳細情報の表示にのみ使う。

> **Note**\
> `source` と `expectedOperator` は、リンク元ページが自ら埋め込んだ値を復号した
> だけで署名を検証していない。ページを支配している側は任意の組織名を名乗れるため
> 自称値として扱うこと。バッジ更新などで既に検証済みの結果と照合できるようにする
> のが望ましいが、現状はその経路がない。

> **Note**\
> OP ID と突き合わせる相手は WMP の `credentialSubject.id` である。`issuer` は OP の
> 発行者 (レジストラ) を指すため全 OP で同じ値になり、広告 CA の issuer とも
> `targetopid` とも一致しない。

`actualOperator` の名前も WMP から取る。Website Profile の `credentialSubject`
はサイトの属性で、その `name` はサイト名、`id` はサイトの URL である。運営者は
`issuer` が指す OP の側にある。WMP が言語ごとに複数あるときは
`@originator-profile/core` の `selectByLocale` で選ぶ。

## 実装

| ファイル                                                  | 役割                                                        |
| --------------------------------------------------------- | ----------------------------------------------------------- |
| [detect-ad-click.ts](./detect-ad-click.ts)                | 全フレームで広告リンクのクリックを検知し `adClicked` を送る |
| [background.ts](./background.ts)                          | Service Worker のイベント配線                               |
| [handlers.ts](./handlers.ts)                              | クリックの受理と、遷移完了時の検証・警告リダイレクト        |
| [verification.ts](./verification.ts)                      | 遷移先の検証と `LinkVerificationResult` の組み立て          |
| [matching.ts](./matching.ts)                              | OP ID の照合と運営者の解決                                  |
| [state.ts](./state.ts)                                    | タブごとの検証状態 (`chrome.storage.session` に永続化)      |
| [events.ts](./events.ts) / [messaging.ts](./messaging.ts) | 拡張機能内メッセージ                                        |

アプリ側は 2 つを呼ぶ。

```ts
// 全フレームのコンテンツスクリプト
import { setupAdClickDetection } from "@originator-profile/extension-common/content-script";
setupAdClickDetection();

// Service Worker
import { setupBackground } from "@originator-profile/extension-common/background";
setupBackground({
  buildWarningUrl: (params) =>
    `${chrome.runtime.getURL("index.html")}#/warning?${params.toString()}`,
  // ...
});
```

### 流れ

1. 広告リンクのクリックを検知し、`targetopid` と組織名を Service Worker へ送る
   (`adClicked`)
2. Service Worker がタブに検証待ち状態を紐付ける。新規タブで開かれた場合は
   `chrome.tabs.onCreated` の `openerTabId` を辿って引き渡す
3. `chrome.webNavigation.onCompleted` で遷移先を検証する。アドレスバー入力・戻る/進む・
   リロードなど手動操作による遷移は `onCommitted` で検証待ちを解除する
4. `matched` でなければ `chrome.scripting.executeScript` で警告ページへ差し替える

### 警告ページ

URL の search params で渡す
([warning-params.ts](../utils/warning-params.ts))。警告ページの場所はアプリごとに
異なるため `buildWarningUrl` で組み立てる。

| パラメータ                              | 内容                              |
| --------------------------------------- | --------------------------------- |
| `target`                                | 警告対象の遷移先 URL              |
| `reason`                                | 警告理由                          |
| `sourceOrg` / `expectedOrg` / `destOrg` | 組織名                            |
| `original`                              | 広告元ページの URL (戻るボタン用) |
| `isNewTab`                              | 新規タブで開かれたか              |

## 既知の限界

新規タブで開かれたかどうかは、`target="_blank"`・修飾キー・ミドルクリック・遷移を
起こさない URL スキームからの推定である。`href="#"` や `preventDefault()` で
`window.open()` を呼ぶ実装は拾えない
([#517](https://github.com/originator-profile/originator-profile/issues/517))。

> **Note**\
> MV3 chrome.webNavigation, chrome.scripting, chrome.storage API 必須

```json
{
  "manifest_version": 3,
  "host_permissions": ["<all_urls>"],
  "permissions": ["scripting", "webNavigation", "storage"]
}
```
