import type { ProblemDetails } from "@originator-profile/verify";
import {
  isSiteProfileFetchError,
  verifyTabWebsite,
} from "../site-profile/verify-website";
import { isMatched, resolveActualOperator } from "./matching";
import type {
  CreateMismatchResultParams,
  LinkVerificationResult,
  VerificationContext,
} from "./types";

/**
 * Site Profile 検証エラー時の結果オブジェクトを生成する
 * @param context - 検証コンテキスト
 * @param problem - 検証失敗の理由
 */
export const createErrorResult = (
  { source, expectedOperator }: VerificationContext,
  problem?: ProblemDetails,
): LinkVerificationResult => {
  return {
    status: "error",
    source,
    expectedOperator,
    reason:
      import.meta.env.MODE === "development"
        ? chrome.i18n.getMessage(
            "Verification_SiteProfileVerifyFailedDetail",
            problem?.title ?? "",
          )
        : chrome.i18n.getMessage("Verification_SiteProfileVerifyFailed"),
  };
};

/**
 * OPID不一致または未設定時の結果オブジェクトを生成する
 * @param params - 不一致結果の生成に必要な情報
 */
export const createMismatchResult = ({
  source,
  expectedOperator,
  actualOperator,
  isMissing,
}: CreateMismatchResultParams): LinkVerificationResult => {
  const reason = isMissing
    ? chrome.i18n.getMessage("Verification_OpidMissing")
    : chrome.i18n.getMessage("Verification_OpidMismatch");
  return {
    status: isMissing ? "missing_opid" : "mismatched",
    source,
    expectedOperator,
    actualOperator,
    reason,
  };
};

/**
 * 遷移先の Web サイトを検証し、OPID の照合結果を返す
 * @param tabId - 検証対象のタブID
 * @param context - 検証コンテキスト
 */
export const getVerificationResult = async (
  tabId: number,
  context: VerificationContext,
): Promise<LinkVerificationResult> => {
  const { source, expectedOperator } = context;

  const { result } = await verifyTabWebsite(tabId);

  // NOTE: 検証を通過した場合だけ照合する。通過していない Website Profile で
  // 照合すると、署名されていない sp.json で matched を作れてしまう。
  if (!result.status) {
    const problem = result.errors[0];
    if (isSiteProfileFetchError(problem)) {
      return createMismatchResult({
        source,
        expectedOperator,
        isMissing: true,
      });
    }
    return createErrorResult(context, problem);
  }

  const { originators, sites } = result.outcome;
  const actualOperator = resolveActualOperator(
    originators,
    sites,
    expectedOperator.id,
  );

  if (isMatched(sites, expectedOperator.id)) {
    return { status: "matched", source, expectedOperator, actualOperator };
  }

  return createMismatchResult({
    source,
    expectedOperator,
    actualOperator,
    isMissing: false,
  });
};
