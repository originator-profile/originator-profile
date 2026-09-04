import type { SiteProfile, WebsiteProfile } from "@originator-profile/model";
import type { VcValidatorFactory } from "@originator-profile/securing-mechanism";
import type { Logger } from "../logger";
import type { Registry } from "../registry";
import { collectProblems } from "../result/collect-problems";
import {
  convertOps,
  convertVc,
  createCollector,
  type OriginatorPayload,
} from "../result/convert";
import { pointer } from "../result/pointer";
import { toProblemDetails } from "../result/to-problem-details";
import type { VerificationResult } from "../result/types";
import { SpVerifier } from "../site-profile";

/** Web サイトの検証結果に含まれる復号ペイロード */
export type WebsiteOutcome = {
  /** 発信者ごとの復号ペイロード */
  originators: OriginatorPayload[];
  /** Website Profile の復号ペイロード。復号できなかった要素は null */
  sites: (WebsiteProfile | null)[];
};

/** Site Profile の検証結果が持つ形 */
type SpLike = { originators: unknown; sites?: unknown[] };

/**
 * Web サイトの検証
 *
 * サイトが提示する Site Profile とレジストリを用いて、指定した origin の
 * サイトを誰が運営しているものとして確認できるかを検証する。
 *
 * @param origin 検証対象のサイトを識別する RFC 6454 オリジン
 * @param options Site Profile・レジストリ・オリジン検証の可否・バリデーター・ロガー
 * @returns 検証結果。復号できたペイロードは status によらず outcome に含まれる
 *
 * @example
 * ```ts
 * const result = await verifyWebsite(location.origin, { siteProfile, registry });
 * result.outcome?.sites;  // Website Profile の復号ペイロード
 * if (!result.status) result.errors;  // 検証失敗の理由
 * ```
 */
export async function verifyWebsite(
  origin: URL["origin"],
  options: {
    /** サイトが提示する Site Profile */
    siteProfile: SiteProfile;
    /** Core Profile 発行者のレジストリ */
    registry: Registry;
    /** WSP が提示された Web サイトの origin との一致性検証の可否 (デフォルト: 有効) */
    verifyOrigin?: boolean;
    /** バリデーター */
    validator?: VcValidatorFactory;
    /** ロガー (デフォルト: `console`) */
    logger?: Logger;
  },
): Promise<VerificationResult<WebsiteOutcome>> {
  const { siteProfile, registry, logger, ...verifierOptions } = options;
  const { logger: collecting, warnings, info } = collectProblems(logger);

  const verifySp = SpVerifier(
    {
      ...siteProfile,
      originators: [...registry.ops, ...siteProfile.originators],
    },
    registry.keys,
    registry.issuer,
    origin,
    { ...verifierOptions, logger: collecting },
  );

  const verified = await verifySp();
  const failed = verified instanceof Error;
  const sp = (failed ? verified.result : verified) as SpLike;

  const collect = createCollector();
  const outcome: WebsiteOutcome = {
    originators: convertOps(sp.originators, collect),
    sites: (sp.sites ?? []).map((site, index) =>
      convertVc<WebsiteProfile>(site, pointer("sites", index), collect),
    ),
  };

  return failed
    ? {
        status: false,
        outcome,
        securingResults: collect.securingResults,
        warnings,
        info,
        errors: [toProblemDetails(verified), ...collect.errors],
      }
    : {
        status: true,
        outcome,
        securingResults: collect.securingResults,
        warnings,
        info,
        errors: collect.errors,
      };
}
