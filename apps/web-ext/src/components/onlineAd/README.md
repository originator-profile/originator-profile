# OnlineAd

OnlineAd Content Attestation が設置された埋め込み広告の位置特定・表示

> [!NOTE]
> この機能は現在の拡張機能では動作しません。
> 予約型広告あるいは運用型広告との連携実証実験時に動作するよう改修予定です。
>
> なお、改修時にはデータ属性以外での埋め込み広告を含むサブフレーム (iframe) を特定する実装に見直すことが望ましいです。
> 詳細は次の issue を確認してください。
>
> - [データ属性以外による HTMLIframeElement と webNavigation.getAllFrames() の紐付け · Issue #40 · originator-profile/originator-profile](https://github.com/originator-profile/originator-profile/issues/40)

全てのフレームから広告プロファイルを取得し、makeAdTree() により広告プロファイルが設置されたフレームの木構造が得られます。

```ts
const frames = (await chrome.webNavigation.getAllFrames({ tabId })) ?? [];
const responses: Array<{
  data: NodeObject;
  origin: string;
  frameId: number;
  parentFrameId: number;
}> = await Promise.all(
  frames.map((frame) =>
    chrome.tabs
      .sendMessage<
        fetchProfileSetMessageRequest,
        fetchProfileSetMessageResponse
      >(
        tabId,
        {
          type: "fetch-profiles",
        },
        {
          frameId: frame.frameId,
        },
      )
      .then((response) => {
        const data = JSON.parse(response.data);
        if (!response.ok) throw data;
        return {
          data,
          origin: response.origin,
          frameId: frame.frameId,
          parentFrameId: frame.parentFrameId,
        };
      }),
  ),
).catch((data) => {
  throw Object.assign(new Error(data.message), data);
});
const ads = await Promise.all(
  responses.map(({ data, origin, frameId, parentFrameId }) =>
    expandProfilePairs(data).then(({ ad }) => ({
      ad,
      origin,
      frameId,
      parentFrameId,
    })),
  ),
);
const adTree = makeAdTree(ads);
if (adTree) await updateAdIframe(tabId, adTree);
```

広告プロファイルが設置されたフレームの木構造から updateAdIframe() でフレームの位置が特定できるようにデータ属性が付与されます。

```ts
function handlePostMessageResponse(event: ContentWindowPostMessageEvent) {
  switch (event.data.type) {
    case "update-ad-iframe": {
      if (event.origin !== event.data.sourceOrigin) return;
      const iframe = Array.from(document.getElementsByTagName("iframe")).find(
        (iframe) => iframe.contentWindow === event.source,
      );
      if (!iframe) return;
      iframe.dataset[DATASET_ATTRIBUTE_CAMEL_CASE] = Array.from(
        new Set(
          (iframe.dataset[DATASET_ATTRIBUTE_CAMEL_CASE] ?? "")
            .split(" ")
            .filter(Boolean)
            .concat(event.data.ad.map(({ dp }) => dp.sub)),
        ),
      ).join(" ");
      break;
    }
  }
}

window.addEventListener("message", handlePostMessageResponse);
```

オーバーレイ表示のための iframe 要素内の React ランタイムから、広告プロファイルが設置されたフレーム要素 (HTMLIframeElement) が取得されます。

```ts
import { useState, useEffect } from "react";
import { DocumentProfile } from "@originator-profile/ui";

/** CSS セレクターで指定した要素を返すフック関数 */
function useElements(dp: DocumentProfile | DocumentProfile[]) {
  const dps = [dp].flat();
  const locations = dps.flatMap((dp) => dp.listLocationsInTopLevel());
  const selector = locations.join(", ") || ":not(*)";
  const [elements, setElements] = useState<HTMLElement[]>([]);
  useEffect(() => {
    const updateElements = () => {
      setElements(
        Array.from(window.parent.document.querySelectorAll(selector)),
      );
    };
    const observer = new MutationObserver(updateElements);
    const iframes = window.parent.document.getElementsByTagName("iframe");
    for (const iframe of iframes) {
      observer.observe(iframe, {
        attributes: true,
        attributeFilter: [DATASET_ATTRIBUTE],
      });
    }
    updateElements();
    return () => {
      observer.disconnect();
    };
    updateElements();
  }, [setElements, selector]);
  return { elements };
}

export default useElements;
```

位置を特定するための CSS セレクターは次のメソッドから得られます。

```ts
/**
 * Document Profile クラス
 */
export class DocumentProfile extends Profile {
  /**
   *
   * @returns 署名対象文字列の位置情報（CSS セレクタ）の配列
   */
  listLocations() {
    return this.listLocatorItems().map(
      (dpLocator) => dpLocator.location ?? ":root",
    );
  }

  /**
   * ページ（トップレベルのフレーム）において、この DP の署名対象文字列が存在する位置を特定するためのセレクタの配列を返す。
   * {@link containTopLevelFrame} が false のときには、トップレベルフレームの子 iframe のセレクタの配列になる。
   * @returns CSS セレクタの配列
   */
  listLocationsInTopLevel() {
    return this.containTopLevelFrame
      ? this.listLocations()
      : [`iframe[${DocumentProfile.DATASET_ATTRIBUTE}~="${this.subject}"]`];
  }
}
```
