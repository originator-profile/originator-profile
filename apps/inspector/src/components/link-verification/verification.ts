import type { ProblemDetails } from "@originator-profile/verify";
import type { LinkVerificationResult } from "../credentials/types";
import {
  isSiteProfileFetchError,
  verifyTabWebsite,
} from "../siteProfile/verify-website";
import { getDestinationOrgName, isMatched } from "./matching";
import type { CreateMismatchResultParams, VerificationContext } from "./types";

/**
 * Site Profile 検証エラー時の結果オブジェクトを生成する
 * @param context - 検証コンテキスト
 * @param problem - 検証失敗の理由
 */
export const createErrorResult = (
  { targetOpId, sourceOrgName, expectedOrgName }: VerificationContext,
  problem?: ProblemDetails,
): LinkVerificationResult => {
  return {
    status: "error",
    expectedOpId: targetOpId,
    sourceOrgName,
    expectedOrgName,
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
  targetOpId,
  sourceOrgName,
  expectedOrgName,
  destinationOrgName,
  isMissing,
}: CreateMismatchResultParams): LinkVerificationResult => {
  const reason = isMissing
    ? chrome.i18n.getMessage("Verification_OpidMissing")
    : chrome.i18n.getMessage("Verification_OpidMismatch");
  return {
    status: isMissing ? "missing_opid" : "mismatched",
    expectedOpId: targetOpId,
    sourceOrgName,
    expectedOrgName,
    destinationOrgName,
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
  const { targetOpId, sourceOrgName, expectedOrgName } = context;

  const { result } = await verifyTabWebsite(tabId);

  // NOTE: 検証を通過した場合だけ照合する。通過していない Website Profile で
  // 照合すると、署名されていない sp.json で matched を作れてしまう。
  if (!result.status) {
    const problem = result.errors[0];
    if (isSiteProfileFetchError(problem)) {
      return createMismatchResult({
        targetOpId,
        sourceOrgName,
        expectedOrgName,
        isMissing: true,
      });
    }
    return createErrorResult(context, problem);
  }

  const { originators, sites } = result.outcome;
  const destinationOrgName = getDestinationOrgName(
    originators,
    sites,
    targetOpId,
  );

  if (isMatched(sites, targetOpId)) {
    return {
      status: "matched",
      expectedOpId: targetOpId,
      sourceOrgName,
      expectedOrgName,
      destinationOrgName,
    };
  }

  return createMismatchResult({
    targetOpId,
    sourceOrgName,
    expectedOrgName,
    destinationOrgName,
    isMissing: false,
  });
};
