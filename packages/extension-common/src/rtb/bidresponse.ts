import { Advertiser, BidResponse } from "./types";

/**
 * BidResponseにadvertiserが存在する場合はAdvertiserを返す
 * それ以外はnullを返す
 */
export function getAdvertiser(data: BidResponse): Advertiser | null {
  try {
    const ops = data?.bidresponse?.bid?.op ?? [];
    const advertiser = ops.find(
      (op: { type: string }) => op.type === "advertiser",
    );

    if (typeof advertiser?.id !== "string") {
      return null;
    }

    return advertiser;
  } catch {
    return null;
  }
}

/**
 * 文書内の BidResponse データの取得
 * @param doc Document オブジェクト
 * @return BidResponseの配列
 */
export function getBidResponses(doc: Document = document) {
  const elements = [
    ...doc.querySelectorAll(`script[type="application/ld+json"]`),
  ];
  const credentialsArray = elements
    .map((elem) => {
      const text = elem.textContent;
      if (typeof text !== "string") {
        return undefined;
      }
      try {
        const json = JSON.parse(text);
        if (json.bidresponse.bid.op === undefined) {
          return undefined;
        }
        return json;
      } catch (e: unknown) {
        return undefined;
      }
    })
    .filter((e) => typeof e !== "undefined");

  return credentialsArray.flat() as BidResponse[];
}
