import { z } from "zod";
import { SubresourceIntegrity } from "../sri";

export const BasicTarget = z.looseObject({
  type: z.enum([
    "TextTargetIntegrity",
    /**
     * @deprecated innerText によるレンダリング結果はブラウザ実装に依存し、ブラウザ間で一致しない。
     * 完全性検証の根拠にはできないため、2027-10-01 以降に廃止する。
     * @see https://docs.originator-profile.org/opb/content-integrity-descriptor/visible-text/
     */
    "VisibleTextTargetIntegrity",
    "HtmlTargetIntegrity",
  ]),
  integrity: SubresourceIntegrity,
  cssSelector: z.string().describe("CSS selector"),
});

export type BasicTarget = z.infer<typeof BasicTarget>;
