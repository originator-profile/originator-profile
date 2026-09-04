import {
  CasVerifyFailed,
  childPointer,
  OpsInvalid,
  OpsVerifyFailed,
  OpVerifyFailed,
  pointer,
  SiteProfileInvalid,
  SiteProfileVerifyFailed,
  type DocumentsOutcome,
  type OriginatorPayload,
  type ProblemDetails,
  type SecuringResult,
  type VerificationResult,
  type VerificationTarget,
  type VerifiedCas,
  type VerifiedOps,
  type VerifiedSp,
  type WebsiteOutcome,
} from "@originator-profile/verify";
import { codeOf } from "./problem-code";
import { toError } from "./to-error";

/**
 * 構造化された検証結果を、従来のエラークラスを含む形に戻す
 *
 * NOTE: CheckList が検証失敗を Error クラスの階層として扱っているための移行用。
 * 表示側が outcome と ProblemDetails を直接扱うようになったら、このモジュール
 * ごと削除する。
 */

/** JSONPath から securing 情報と問題を引くための索引 */
type Index = {
  securing: Map<string, SecuringResult>;
  problems: Map<string, ProblemDetails[]>;
};

function createIndex(result: {
  securingResults: SecuringResult[];
  errors: ProblemDetails[];
}): Index {
  const problems = new Map<string, ProblemDetails[]>();
  for (const problem of result.errors) {
    if (!problem.pointer) continue;
    const list = problems.get(problem.pointer) ?? [];
    list.push(problem);
    problems.set(problem.pointer, list);
  }

  return {
    securing: new Map(result.securingResults.map((s) => [s.pointer, s])),
    problems,
  };
}

/** 復号ペイロードと securing 情報から、従来の VC の形を組み立てる */
function restoreVc(doc: unknown, at: string, index: Index): unknown {
  if (doc === null || doc === undefined) return undefined;

  const securing = index.securing.get(at);
  return {
    doc,
    source: securing?.source,
    issuedAt: securing?.issuedAt,
    expiredAt: securing?.expiredAt,
    mediaType: securing?.mediaType,
    algorithm: securing?.algorithm,
    ...(securing?.verificationKey && {
      verificationKey: securing.verificationKey,
      validated: false,
    }),
  };
}

function toLegacyVc(doc: unknown, at: string, index: Index): unknown {
  const vc = restoreVc(doc, at, index);
  const problems = index.problems.get(at) ?? [];
  if (problems.length === 0) return vc;

  return Object.assign(new Error(problems[0]?.title ?? "Verify failed"), {
    code: problems[0] && codeOf(problems[0].type),
    result: vc,
  });
}

function toLegacyOp(
  payload: OriginatorPayload,
  at: string,
  index: Index,
): unknown {
  const value = {
    core: toLegacyVc(payload.core, childPointer(at, "core"), index),
    ...(payload.annotations && {
      annotations: payload.annotations.map((annotation, i) =>
        toLegacyVc(annotation, childPointer(at, "annotations", i), index),
      ),
    }),
    ...(payload.media && {
      media: payload.media.map((media, i) =>
        toLegacyVc(media, childPointer(at, "media", i), index),
      ),
    }),
  };

  const children = [
    value.core,
    ...(value.annotations ?? []),
    ...(value.media ?? []),
  ];
  const problems = index.problems.get(at) ?? [];
  if (
    !children.some((child) => child instanceof Error) &&
    problems.length === 0
  )
    return value;

  return new OpVerifyFailed(
    problems[0]?.title ?? "Originator Profile verify failed",
    value as never,
  );
}

function toLegacyOps(payloads: OriginatorPayload[], index: Index): unknown {
  const list = payloads.map((payload, i) =>
    toLegacyOp(payload, pointer("originators", i), index),
  );
  const problems = index.problems.get(pointer("originators")) ?? [];
  if (!list.some((op) => op instanceof Error) && problems.length === 0)
    return list;

  return new OpsVerifyFailed(
    problems[0]?.title ?? "Originator Profile Set verify failed",
    list as never,
  );
}

/**
 * Web サイトの検証結果を、従来の SpVerifier の戻り値の形に戻す
 * @param result 検証結果
 * @returns 検証済み Site Profile、または検証失敗を表すエラー
 */
export function toLegacyWebsite(
  result: VerificationResult<WebsiteOutcome>,
): VerifiedSp | Error {
  if (!result.outcome) return toError(result.errors[0]);

  const index = createIndex(result);
  const value = {
    originators: toLegacyOps(result.outcome.originators, index),
    sites: result.outcome.sites.map((site, i) =>
      toLegacyVc(site, pointer("sites", i), index),
    ),
  };

  if (result.status) return value as unknown as VerifiedSp;

  const problem = result.errors.find(({ pointer: at }) => !at);
  const message = problem?.title ?? "Site Profile verify failed";
  return problem && codeOf(problem.type) === SiteProfileInvalid.code
    ? new SiteProfileInvalid(message, value as never)
    : new SiteProfileVerifyFailed(message, value as never);
}

/** 従来の形に戻した文書群の検証結果 */
export type LegacyDocuments<Target extends VerificationTarget> = {
  ops: VerifiedOps;
  documents: { target: Target; cas: VerifiedCas }[];
};

const isOpsProblem = (code?: string): boolean =>
  code === OpsInvalid.code || code === OpsVerifyFailed.code;

/**
 * 文書群の検証失敗を、従来のエラークラスに戻す
 * @param problem 検証失敗の理由
 * @param ops 復元済みの発信者プロファイル集合
 * @param documents 復元済みの文書ごとの Content Attestation
 */
function toLegacyDocumentsFailure(
  problem: ProblemDetails | undefined,
  ops: unknown,
  documents: { cas: VerifiedCas }[],
): Error {
  const code = problem && codeOf(problem.type);
  const message = problem?.title ?? "Verify failed";

  if (code === CasVerifyFailed.code) {
    const failed = documents.find(({ cas }) =>
      cas.some(({ attestation }) => attestation instanceof Error),
    );
    return new CasVerifyFailed(message, failed?.cas ?? []);
  }
  if (!isOpsProblem(code)) return toError(problem);

  // NOTE: toLegacyOps は失敗を含む場合すでに OpsVerifyFailed を返している。
  // 二重に包むと result が配列でなくなり、表示側の走査が壊れる。
  return ops instanceof Error
    ? ops
    : new OpsVerifyFailed(message, ops as never);
}

/**
 * 文書群の検証結果を、従来の verifyDocuments の戻り値の形に戻す
 * @param result 検証結果
 * @returns 検証済みの発信者と文書、または検証失敗を表すエラー
 */
export function toLegacyDocuments<Target extends VerificationTarget>(
  result: VerificationResult<DocumentsOutcome<Target>>,
): LegacyDocuments<Target> | Error {
  if (!result.outcome) return toError(result.errors[0]);

  const index = createIndex(result);
  const ops = toLegacyOps(result.outcome.originators, index);
  const documents = result.outcome.documents.map(({ target, cas }, i) => ({
    target,
    cas: cas.map(({ main, attestation }, j) => ({
      main,
      attestation: toLegacyVc(
        attestation,
        pointer("documents", i, "cas", j, "attestation"),
        index,
      ),
    })) as VerifiedCas,
  }));

  return result.status
    ? { ops: ops as VerifiedOps, documents }
    : toLegacyDocumentsFailure(result.errors[0], ops, documents);
}
