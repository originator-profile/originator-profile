import { Keys, LocalKeys } from "@originator-profile/cryptography";
import {
  AllowedOrigin,
  SiteProfile,
  WebsiteProfile,
} from "@originator-profile/model";
import {
  JwtVcDecoder,
  JwtVcVerificationResult,
  JwtVcVerifier,
  UnverifiedJwtVc,
  VcValidator,
  VerifiedJwtVc,
} from "@originator-profile/securing-mechanism";
import { verifyImageDigestSri } from "../integrity";
import {
  CoreProfileNotFound,
  OpsInvalid,
  OpsVerifyFailed,
} from "../originator-profile-set/errors";
import { VerifiedOps } from "../originator-profile-set/types";
import { OpsVerifier } from "../originator-profile-set/verify-ops";
import { verifyAllowedOrigin } from "../verify-allowed-origin";
import type { WarnHandler } from "../warn";
import { SpVerificationResult } from "./types";
import { SiteProfileInvalid, SiteProfileVerifyFailed } from "./verify-errors";

/** WSPソースの取得と初期デコード */
const decodeWebsiteProfiles = (
  sp: SiteProfile,
  opsVerified: VerifiedOps,
):
  | { decodedWsps: UnverifiedJwtVc<WebsiteProfile>[]; wspSources: string[] }
  | SiteProfileInvalid => {
  // NOTE: 2026-11-01 まで後方互換性のため、sitesが存在しない場合はcredentialを使用
  const wspSources = sp.sites || (sp.credential ? [sp.credential] : []);
  if (wspSources.length === 0) {
    return new SiteProfileInvalid("No Website Profile found", {
      originators: opsVerified,
      sites: [],
    });
  }

  const decodeWsp = JwtVcDecoder<WebsiteProfile>();
  const decodedWsps = wspSources.map(decodeWsp);

  // デコードエラーチェック（配列全体を確認）
  const decodeErrors = decodedWsps.filter((wsp) => wsp instanceof Error);
  if (decodeErrors.length > 0) {
    return new SiteProfileInvalid("Website Profile invalid", {
      originators: opsVerified,
      sites: decodeErrors,
    });
  }

  return {
    decodedWsps: decodedWsps as UnverifiedJwtVc<WebsiteProfile>[],
    wspSources,
  };
};

/**
 * Site Profile の検証者の作成
 * @param sp Site Profile
 * @param keys Core Profile の発行者の検証鍵
 * @param issuer Core Profile の発行者
 * @param origin 提示するWebサイトを識別するための RFC 6454 オリジン
 * @param options オリジン検証の可否・バリデーター・警告ハンドラー
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
    validator?: typeof VcValidator;
    /** 警告ハンドラー (デフォルト: `console.warn`) */
    warn?: WarnHandler;
  } = {},
) {
  const { verifyOrigin = true, validator, warn } = options;
  async function verify(): Promise<SpVerificationResult> {
    const verifyOps = OpsVerifier(sp.originators, keys, issuer, {
      validator,
      warn,
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

    const decoded = decodeWebsiteProfiles(sp, opsVerified);
    if (decoded instanceof SiteProfileInvalid) {
      return decoded;
    }
    const { decodedWsps, wspSources } = decoded;

    // 全てのWSPを検証
    const verifiedWsps = await Promise.all(
      decodedWsps.map(async (decodedWsp, index) => {
        if (decodedWsp instanceof Error) {
          return decodedWsp;
        }

        const wspIssuer = decodedWsp.doc.issuer;
        const cp = opsVerified.find(
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

        const verified = await verifyWsp(wspSources[index]);
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
          warn,
        });

        return verified;
      }),
    );

    // エラーチェック - CoreProfileNotFoundはInvalid、その他のエラーはVerifyFailed
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
