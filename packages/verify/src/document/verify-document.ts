import type {
  ContentAttestationSet,
  OriginatorProfileSet,
} from "@originator-profile/model";
import type { VcValidatorFactory } from "@originator-profile/securing-mechanism";
import { CasVerifyFailed, verifyCas } from "../content-attestation-set";
import type { VerifyIntegrity } from "../integrity";
import type { Logger } from "../logger";
import {
  OpsInvalid,
  OpsVerifier,
  OpsVerifyFailed,
} from "../originator-profile-set";
import type { OriginatorsOutcome, Registry } from "../registry";
import { collectProblems } from "../result/collect-problems";
import {
  convertCas,
  convertOps,
  createCollector,
  type CasPayload,
  type OriginatorPayload,
} from "../result/convert";
import { pointer } from "../result/pointer";
import { toProblemDetails } from "../result/to-problem-details";
import type { SecuringResult, VerificationResult } from "../result/types";

/** 文書が置かれているフレームの種類 */
export type FrameType = "outermost_frame" | "sub_frame" | "fenced_frame";

/** 検証対象の文書 */
export type VerificationTarget = {
  /** 文書に設置された Originator Profile Set */
  ops: OriginatorProfileSet;
  /** 文書に設置された Content Attestation Set */
  cas: ContentAttestationSet;
  /** 文書の URL */
  url: string;
  /** 文書が置かれているフレームの種類 */
  frameType: FrameType;
  /** 文書内の Target Integrity 検証器 */
  verifyIntegrity: VerifyIntegrity;
};

/** 文書の検証結果に含まれる復号ペイロード */
export type DocumentOutcome<Target extends VerificationTarget> = {
  /** 検証対象の文書 */
  target: Target;
  /** 発信者ごとの復号ペイロード */
  originators: OriginatorPayload[];
  /** Content Attestation の復号ペイロード */
  cas: CasPayload[];
};

/**
 * 文書の検証のカテゴリー
 *
 * - `ca-vc`: CA の VC 検証 (image データ型を除く)
 * - `allowed-url`: allowedUrl の検証
 * - `content-integrity`: Content Integrity Descriptor の検証
 * - `originator-ops`: 発行者の OP を含む OPS の検証
 * - `image`: image データ型の検証
 *
 * @see https://docs.originator-profile.org/ja/opb/verifier-processing-model/content-attestation-set/
 */
export type VerificationCategory =
  | "ca-vc"
  | "allowed-url"
  | "content-integrity"
  | "originator-ops"
  | "image";

/**
 * verifyDocument が適用する検証のカテゴリー
 *
 * NOTE: image データ型は検証するが、移行期間中は失敗を警告にとどめて結果の状態に
 * 反映しないため、範囲に含めない
 */
const documentScope: VerificationCategory[] = [
  "ca-vc",
  "allowed-url",
  "content-integrity",
  "originator-ops",
];

/** 検証に用いた入力の出所 */
export type InputSource =
  | { kind: "registry" }
  | { kind: "site-profile" }
  | { kind: "document"; url: string };

/** 文書の検証結果が併せて持つ情報 */
export type DocumentVerificationMetadata = {
  /** 検証時刻 (ISO 8601) */
  verifiedAt: string;
  /** 結果が有効である時刻の境界 (ISO 8601)。用いた VC の有効期限の最小値 */
  validUntil?: string;
  /** 適用した検証のカテゴリー */
  scope: VerificationCategory[];
  /** 検証に用いた入力の出所 */
  inputRange: InputSource[];
};

/** 文書の検証結果 */
export type DocumentVerificationResult<Target extends VerificationTarget> =
  VerificationResult<DocumentOutcome<Target>> & DocumentVerificationMetadata;

/** 検証に用いた入力の出所 */
const inputRangeOf = (
  shared: SharedOriginators,
  url: string,
): InputSource[] => [
  { kind: "registry" },
  ...(shared.source === "site-profile"
    ? [{ kind: "site-profile" } as const]
    : []),
  { kind: "document", url },
];

/** 検証済みの発信者の Core Profile */
const coreProfilesOf = (originators: OriginatorPayload[]) =>
  originators.flatMap(({ core }) => (core ? [{ core: { doc: core } }] : []));

/** 用いた VC の有効期限のうち最も早いもの */
function earliestExpiration(securingResults: SecuringResult[]) {
  const expirations = securingResults.flatMap(({ expiredAt }) =>
    expiredAt ? [expiredAt] : [],
  );
  if (expirations.length === 0) return undefined;
  return new Date(
    Math.min(...expirations.map((value) => new Date(value).getTime())),
  ).toISOString();
}

/**
 * 検証済みの共有の発信者
 *
 * 文書をまたいで用いてよい発信者の検証結果。`registry` はレジストリの検証結果
 * ({@link verifyRegistry})、`site-profile` はトップレベル文書のオリジンの
 * Web サイトの検証結果 ({@link verifyWebsite}。レジストリの発信者を含む)。
 */
export type SharedOriginators = {
  source: "registry" | "site-profile";
  result: VerificationResult<OriginatorsOutcome>;
};

/**
 * 文書の検証
 *
 * 検証済みの共有の発信者と、その文書に設置された Originator Profile Set を用いて
 * 文書の Content Attestation Set を検証する。共有の発信者は検証し直さず、文書の
 * OPS だけを検証する。他の文書に設置された OPS は用いない。
 *
 * 結果はその文書の OPS と CAS の分だけを含み、共有の発信者は含まない。どの共有の
 * 発信者を用いたかは `inputRange` が示す。
 *
 * @param target 検証対象の文書
 * @param options レジストリ・共有の発信者・バリデーター・ロガー
 * @returns 検証結果。復号できたペイロードは status によらず outcome に含まれる
 * @throws {TypeError} トップレベル文書でない文書に Web サイトの発信者を渡した
 *
 * @example
 * ```ts
 * const shared = { source: "registry", result: await verifyRegistry(registry) };
 * const result = await verifyDocument(target, { registry, shared });
 * result.outcome?.cas; // Content Attestation の復号ペイロード
 * if (!result.status) result.errors; // 検証失敗の理由
 * ```
 */
export async function verifyDocument<
  Target extends VerificationTarget = VerificationTarget,
>(
  target: Target,
  options: {
    /** Core Profile 発行者のレジストリ。文書の OPS の Core Profile の検証に用いる */
    registry: Registry;
    /** 検証済みの共有の発信者 */
    shared: SharedOriginators;
    /** バリデーター */
    validator?: VcValidatorFactory;
    /** ロガー (デフォルト: `console`) */
    logger?: Logger;
  },
): Promise<DocumentVerificationResult<Target>> {
  const { registry, shared, validator, logger } = options;
  // NOTE: サブフレーム中のコンテンツの検証にトップレベル文書の SP を用いてはならない
  // see https://docs.originator-profile.org/ja/opb/verifier-processing-model/site-profile/
  if (
    shared.source === "site-profile" &&
    target.frameType !== "outermost_frame"
  ) {
    throw new TypeError(
      "Site Profile originators must not be used for documents in sub frames",
    );
  }

  const verifiedAt = new Date().toISOString();
  const { logger: collecting, warnings, info } = collectProblems(logger);
  const collect = createCollector();
  const trusted = shared.result.outcome?.originators ?? [];

  const inputRange = inputRangeOf(shared, target.url);
  const metadata = () => ({
    verifiedAt,
    // NOTE: 結果は共有の発信者の VC にも依存するため、その有効期限も境界に含める
    validUntil: earliestExpiration([
      ...shared.result.securingResults,
      ...collect.securingResults,
    ]),
    scope: documentScope,
    inputRange,
  });

  if (!shared.result.status) {
    return {
      status: false,
      outcome: { target, originators: [], cas: [] },
      securingResults: [],
      warnings,
      info,
      // 共有の発信者の中を指す問題は、この結果の outcome を指さないため除く
      errors: shared.result.errors.filter(({ pointer: at }) => !at),
      ...metadata(),
    };
  }

  const verifiedOps = await OpsVerifier(
    target.ops,
    registry.keys,
    registry.issuer,
    { validator, logger: collecting, trusted },
  )();
  const originators = convertOps(verifiedOps, collect);

  if (
    verifiedOps instanceof OpsInvalid ||
    verifiedOps instanceof OpsVerifyFailed
  ) {
    return {
      status: false,
      outcome: { target, originators, cas: [] },
      securingResults: collect.securingResults,
      warnings,
      info,
      errors: [toProblemDetails(verifiedOps), ...collect.errors],
      ...metadata(),
    };
  }

  const cas = await verifyCas(
    target.cas,
    [...coreProfilesOf(trusted), ...verifiedOps],
    target.url,
    target.verifyIntegrity,
    validator,
    collecting,
    pointer(),
  );

  const outcome: DocumentOutcome<Target> = {
    target,
    originators,
    cas: convertCas(
      cas instanceof CasVerifyFailed ? cas.result : cas,
      pointer(),
      collect,
    ),
  };

  return cas instanceof CasVerifyFailed
    ? {
        status: false,
        outcome,
        securingResults: collect.securingResults,
        warnings,
        info,
        errors: [toProblemDetails(cas, pointer("cas")), ...collect.errors],
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
