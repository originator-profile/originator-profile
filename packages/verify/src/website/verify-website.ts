import type { SiteProfile, WebsiteProfile } from "@originator-profile/model";
import type { VcValidatorFactory } from "@originator-profile/securing-mechanism";
import type { Logger } from "../logger";
import {
  verifyRegistry,
  type OriginatorsOutcome,
  type Registry,
} from "../registry";
import { collectProblems } from "../result/collect-problems";
import {
  convertOps,
  convertVc,
  createCollector,
  type OriginatorPayload,
} from "../result/convert";
import { timeBoundaryOf, type VerificationMetadata } from "../result/metadata";
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

/**
 * Web サイトの検証のカテゴリー
 *
 * - `sp-vc`: sites と originators の VC 検証 (image データ型を除く)
 * - `allowed-origin`: allowedOrigin の検証
 * - `image`: image データ型の検証
 *
 * @see https://docs.originator-profile.org/ja/opb/verifier-processing-model/site-profile/
 */
export type WebsiteVerificationCategory = "sp-vc" | "allowed-origin" | "image";

/** Web サイトの検証結果 */
export type WebsiteVerificationResult = VerificationResult<WebsiteOutcome> &
  VerificationMetadata<WebsiteVerificationCategory>;

/**
 * 適用する検証のカテゴリー
 *
 * NOTE: image データ型は検証するが、移行期間中は失敗を警告にとどめて結果の状態に
 * 反映しないため、範囲に含めない
 */
const scopeOf = (verifyOrigin: boolean): WebsiteVerificationCategory[] =>
  verifyOrigin ? ["sp-vc", "allowed-origin"] : ["sp-vc"];

/**
 * Web サイトの検証
 *
 * サイトが提示する Site Profile とレジストリを用いて、指定した origin の
 * サイトを誰が運営しているものとして確認できるかを検証する。
 *
 * 結果の originators は Site Profile の発信者だけを含み、レジストリの発信者は
 * 含まない。
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
    /**
     * レジストリの検証結果 ({@link verifyRegistry})。省略するとレジストリを検証する。
     * 検証に失敗していれば、Web サイトの検証も失敗とする
     */
    verifiedRegistry?: VerificationResult<OriginatorsOutcome>;
    /** WSP が提示された Web サイトの origin との一致性検証の可否 (デフォルト: 有効) */
    verifyOrigin?: boolean;
    /** バリデーター */
    validator?: VcValidatorFactory;
    /** ロガー (デフォルト: `console`) */
    logger?: Logger;
  },
): Promise<WebsiteVerificationResult> {
  const verifiedAt = new Date().toISOString();
  const {
    siteProfile,
    registry,
    logger,
    verifiedRegistry: _,
    ...verifierOptions
  } = options;
  const verifiedRegistry =
    options.verifiedRegistry ??
    (await verifyRegistry(registry, { validator: options.validator, logger }));
  const { logger: collecting, warnings, info } = collectProblems(logger);
  const collect = createCollector();
  const metadata = (): VerificationMetadata<WebsiteVerificationCategory> => ({
    verifiedAt,
    // NOTE: 結果はレジストリの VC にも依存するため、その有効期間も境界に含める
    validUntil: timeBoundaryOf(
      [...verifiedRegistry.securingResults, ...collect.securingResults],
      verifiedAt,
    ),
    scope: scopeOf(options.verifyOrigin ?? true),
    inputRange: [{ kind: "registry" }, { kind: "site-profile" }],
  });

  if (!verifiedRegistry.status) {
    return {
      status: false,
      securingResults: [],
      warnings,
      info,
      // レジストリの中を指す問題は、この結果の outcome を指さないため除く
      errors: verifiedRegistry.errors.filter(({ pointer: at }) => !at),
      ...metadata(),
    };
  }

  const verifySp = SpVerifier(
    siteProfile,
    registry.keys,
    registry.issuer,
    origin,
    {
      ...verifierOptions,
      logger: collecting,
      trusted: verifiedRegistry.outcome.originators,
    },
  );

  const verified = await verifySp();
  const failed = verified instanceof Error;
  const sp = failed ? verified.result : verified;

  const outcome: WebsiteOutcome = {
    originators: convertOps(sp.originators, collect),
    sites: sp.sites.map((site, index) =>
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
        ...metadata(),
      }
    : {
        status: true,
        outcome,
        securingResults: collect.securingResults,
        warnings,
        info,
        ...metadata(),
      };
}
