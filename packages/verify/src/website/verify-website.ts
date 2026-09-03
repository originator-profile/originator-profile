import type { SiteProfile } from "@originator-profile/model";
import type { VcValidator } from "@originator-profile/securing-mechanism";
import type { Logger } from "../logger";
import type { Registry } from "../registry";
import { SpVerifier, type SpVerificationResult } from "../site-profile";

/**
 * Web サイトの検証
 *
 * サイトが提示する Site Profile とレジストリを用いて、指定した origin の
 * サイトを誰が運営しているものとして確認できるかを検証する。
 *
 * @param origin 検証対象のサイトを識別する RFC 6454 オリジン
 * @param options Site Profile・レジストリ・オリジン検証の可否・バリデーター・ロガー
 * @returns 検証結果
 *
 * @example
 * ```ts
 * const verified = await verifyWebsite(location.origin, { siteProfile, registry });
 * if (verified instanceof Error) {
 *   verified; // SiteProfileInvalid | SiteProfileVerifyFailed
 *   return;
 * }
 * verified.sites; // 検証済み Website Profile
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
    validator?: typeof VcValidator;
    /** ロガー (デフォルト: `console`) */
    logger?: Logger;
  },
): Promise<SpVerificationResult> {
  const { siteProfile, registry, ...verifierOptions } = options;

  const verifySp = SpVerifier(
    {
      ...siteProfile,
      originators: [...registry.ops, ...siteProfile.originators],
    },
    registry.keys,
    registry.issuer,
    origin,
    verifierOptions,
  );

  return verifySp();
}
