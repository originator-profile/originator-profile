import { getAdvertiser, getBidResponses } from "./bidresponse";
import { Advertiser, BidResponse } from "./types";

type FrameList = {
  tabId: number;
  frameIds: number[];
};

/**
 * 自身フレームのBidResponseの取得
 * @remarks
 * MV3 chrome.scripting API 必須
 */
async function findBidResponses(frames: FrameList): Promise<BidResponse[]> {
  const res = await chrome.scripting.executeScript({
    target: {
      tabId: frames.tabId,
      frameIds: frames.frameIds,
    },
    func: getBidResponses,
  });

  return res.flatMap((res) => res?.result ?? []);
}

/**
 * 最上位を除く自身または祖先のフレームから最初に見つけたAdvertiserを返す
 * @remarks
 * MV3 chrome.webNavigation, chrome.scripting API 必須
 */
export async function findAdvertiser({
  tabId,
  frameIds,
}: FrameList): Promise<Advertiser> {
  const allFrames =
    (await chrome.webNavigation.getAllFrames({
      tabId: tabId,
    })) ?? [];

  /** 最上位を除く親のフレームIDの一覧 */
  const parentFrameIds = allFrames.flatMap((frame) =>
    frame.parentFrameId !== -1 && frameIds.includes(frame.frameId)
      ? [frame.parentFrameId]
      : [],
  );

  // 最上位フレームでは探索終了
  if (parentFrameIds.length === 0) {
    return {
      type: "advertiser",
      id: undefined,
    };
  }

  const bids: BidResponse[] = await findBidResponses({ tabId, frameIds });
  const adv = bids.map((obj) => getAdvertiser(obj)).find((adv) => adv);

  if (adv) {
    return adv;
  }

  const res = await findAdvertiser({
    tabId,
    frameIds: [...new Set(parentFrameIds)],
  });

  return res;
}
