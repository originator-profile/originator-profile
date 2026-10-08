import { Keys, LocalKeys } from "@originator-profile/cryptography";
import {
  AllowedOrigin,
  SiteProfile,
  WebsiteProfile,
} from "@originator-profile/model";
import {
  JwtVcDecoder,
  type JwtVcDecodingResult,
  JwtVcVerificationResult,
  JwtVcVerifier,
  type VcValidatorFactory,
  type VerifiedJwtVc,
} from "@originator-profile/securing-mechanism";
import { verifyImageDigestSri } from "../integrity";
import type { Logger } from "../logger";
import {
  CoreProfileNotFound,
  OpsInvalid,
  OpsVerifyFailed,
} from "../originator-profile-set/errors";
import { VerifiedOps } from "../originator-profile-set/types";
import { OpsVerifier } from "../originator-profile-set/verify-ops";
import { coreProfilesOf, type OriginatorPayload } from "../result/convert";
import { pointer } from "../result/pointer";
import { verifyAllowedOrigin } from "../verify-allowed-origin";
import { SpVerificationFailure, SpVerificationResult } from "./types";
import { SiteProfileInvalid, SiteProfileVerifyFailed } from "./verify-errors";

/** WSPソースの取得と初期デコード */
const decodeWebsiteProfiles = (
  sp: SiteProfile,
  opsVerified: VerifiedOps,
): JwtVcDecodingResult<WebsiteProfile>[] | SiteProfileInvalid => {
  // NOTE: 2026-11-01 まで後方互換性のため、sitesが存在しない場合はcredentialを使用
  const wspSources = sp.sites || (sp.credential ? [sp.credential] : []);
  if (wspSources.length === 0) {
    return new SiteProfileInvalid("No Website Profile found", {
      originators: opsVerified,
      sites: [],
    });
  }

  const decodeWsp = JwtVcDecoder<WebsiteProfile>();
  return wspSources.map(decodeWsp);
};

/**
 * Site Profile の検証者の作成
 * @param sp Site Profile
 * @param keys Core Profile の発行者の検証鍵
 * @param issuer Core Profile の発行者
 * @param origin 提示するWebサイトを識別するための RFC 6454 オリジン
 * @param options オリジン検証の可否・バリデーター・ロガー
 * @returns 検証者
 */
export function SpVerifier(
  sp: SiteProfile,
  keys: Keys,
  issuer: string | string[],
  origin: URL["origin"],
  options: {
    /** WSPが提示されたWebサイトのorigin引数との一致性検証の可否 (デフォルト: 有効) */
    verifyOrigin?: boolean;
    /** バリデーター */
    validator?: VcValidatorFactory;
    /** ロガー (デフォルト: `console`) */
    logger?: Logger;
    /**
     * 検証済みの共有の OP (レジストリなど)
     *
     * 検証し直さずに、PA・WMP の検証鍵と WSP の発行者の探索に加える。
     * 結果の originators には含めない。
     */
    trusted?: OriginatorPayload[];
  } = {},
) {
  const {
    verifyOrigin = true,
    validator,
    logger = console,
    trusted = [],
  } = options;
  async function verify(): Promise<SpVerificationResult> {
    const verifyOps = OpsVerifier(sp.originators, keys, issuer, {
      validator,
      logger,
      trusted,
    });
    const opsVerified = await verifyOps();
    if (opsVerified instanceof OpsInvalid) {
      return new SiteProfileInvalid("Originator Profile Set invalid", {
        originators: opsVerified,
        sites: [],
      });
    }
    if (opsVerified instanceof OpsVerifyFailed) {
      return new SiteProfileVerifyFailed(
        "Originator Profile Set verify failed",
        { originators: opsVerified, sites: [] },
      );
    }

    const decodedWsps = decodeWebsiteProfiles(sp, opsVerified);
    if (decodedWsps instanceof SiteProfileInvalid) {
      return decodedWsps;
    }

    // デコードできたWSPを全て検証（デコード失敗はそのままインデックスを揃えて保持）
    const verifiedWsps = await Promise.all(
      decodedWsps.map(async (decodedWsp, index) => {
        if (decodedWsp instanceof Error) {
          return decodedWsp;
        }

        const wspIssuer = decodedWsp.doc.issuer;
        const cp = [...coreProfilesOf(trusted), ...opsVerified].find(
          (op) => op.core.doc.credentialSubject.id === wspIssuer,
        );
        if (!cp) {
          return new CoreProfileNotFound<WebsiteProfile>(
            `Missing Core Profile (${wspIssuer})`,
            decodedWsp,
          );
        }

        const verifyWsp = JwtVcVerifier<WebsiteProfile>(
          LocalKeys(cp.core.doc.credentialSubject.jwks),
          cp.core.doc.credentialSubject.id,
          validator?.(WebsiteProfile),
        );

        const verified = await verifyWsp(decodedWsp.source);
        if (verified instanceof Error) {
          return verified;
        }

        if (verifyOrigin) {
          const allowedOrigin =
            "allowedOrigin" in verified.doc.credentialSubject
              ? (verified.doc.credentialSubject.allowedOrigin as AllowedOrigin)
              : verified.doc.credentialSubject.url; // NOTE: 後方互換性のため 2026-10-01 まで url プロパティを許容

          if (!verifyAllowedOrigin(origin, allowedOrigin)) {
            return new Error("Origin not allowed");
          }
        }

        await verifyImageDigestSri(verified.doc.credentialSubject.image, {
          logger,
          at: pointer("sites", index),
        });

        return verified;
      }),
    );

    // エラーチェック - デコード失敗とCoreProfileNotFoundはInvalid、その他のエラーはVerifyFailed
    const decodeErrorIndexes = decodedWsps
      .map((wsp, index) => (wsp instanceof Error ? index : null))
      .filter((index): index is number => index !== null);
    if (decodeErrorIndexes.length > 0) {
      return new SiteProfileInvalid(
        `Website Profile invalid (${decodeErrorIndexes.map((index) => `sites[${index}]`).join(", ")})`,
        {
          originators: opsVerified,
          sites: verifiedWsps as SpVerificationFailure["sites"],
        },
      );
    }

    const hasCoreProfileNotFound = verifiedWsps.some(
      (wsp) => wsp instanceof CoreProfileNotFound,
    );
    if (hasCoreProfileNotFound) {
      return new SiteProfileInvalid("Appropriate Core Profile not found", {
        originators: opsVerified,
        sites: verifiedWsps as (
          | JwtVcVerificationResult<WebsiteProfile>
          | CoreProfileNotFound<WebsiteProfile>
        )[],
      });
    }

    const hasError = verifiedWsps.some((wsp) => wsp instanceof Error);
    if (hasError) {
      return new SiteProfileVerifyFailed("Website Profile verify failed", {
        originators: opsVerified,
        sites: verifiedWsps as JwtVcVerificationResult<WebsiteProfile>[],
      });
    }

    // 常に新仕様（sites配列）で返す
    return {
      originators: opsVerified,
      sites: verifiedWsps as VerifiedJwtVc<WebsiteProfile>[],
    };
  }
  return verify;
}
