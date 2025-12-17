import { ProfilePair } from "@originator-profile/verify";
import crypto from "node:crypto";
import { expect, test } from "vitest";
import { AdNode, AdTree, collectAdFromTree, makeAdTree } from "./ad-tree";

test("collectAdFromTree()は根が先頭・自身が先・親が先になるように配列を整列して返す", () => {
  const ad = (dpId = crypto.randomUUID()): ProfilePair => ({
    op: {
      iss: "example.org",
      sub: "ad.example.com",
      profile: "<SOP>",
    },
    dp: {
      sub: dpId,
      profile: "<SDP>",
    },
  });

  const adNode = (parentFrameId: number, frameId: number): AdNode => ({
    ad: [ad()],
    frameId,
    parentFrameId,
    origin: "null",
  });

  const ad1 = adNode(-1, 1);
  const ad11 = adNode(1, 11);
  const ad111 = adNode(11, 111);
  const ad12 = adNode(1, 12);
  const ad123 = adNode(12, 123);

  const ads: AdNode[] = [ad111, ad11, ad1, ad12, ad123];

  expect(collectAdFromTree(makeAdTree(ads) as AdTree)).toEqual([
    ...ad1.ad,
    ...ad11.ad,
    ...ad111.ad,
    ...ad12.ad,
    ...ad123.ad,
  ]);
});
