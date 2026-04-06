import { SiteProfile, WebsiteProfile } from "@originator-profile/model";
import { JwtVcDecoder } from "@originator-profile/securing-mechanism";
import { DecodedOp, decodeOps } from "@originator-profile/verify";
import { fetchTabCredentials } from "../credentials";
import type { LinkVerificationResult } from "../credentials/types";
import { fetchTabSiteProfile } from "../siteProfile";
import type { CreateMismatchResultParams, VerificationContext } from "./types";

export const decodeWsps = (sp: SiteProfile | null) => {
  if (!sp) return [];
  const decodeWsp = JwtVcDecoder<WebsiteProfile>();
  // 'sites'（新形式）と 'credential'（旧形式）の両方に対応
  const sources = sp.sites ?? (sp.credential ? [sp.credential] : []);
  return sources
    .map((jwt) => {
      const decoded = decodeWsp(jwt);
      return decoded instanceof Error ? null : decoded;
    })
    .filter((wsp): wsp is NonNullable<typeof wsp> => wsp !== null);
};

export const getOrgNameFromOp = (op: DecodedOp): string | undefined => {
  if (!op.annotations) return undefined;
  const annotationWithName = op.annotations.find(
    (a) =>
      "name" in a.doc.credentialSubject &&
      typeof a.doc.credentialSubject.name === "string",
  );
  if (annotationWithName) {
    return (annotationWithName.doc.credentialSubject as { name: string }).name;
  }
  return undefined;
};

export const resolveName = (
  wsp: NonNullable<ReturnType<typeof decodeWsps>[0]>,
  decodedOps: DecodedOp[],
): string | undefined => {
  const op = decodedOps.find(
    (o) => o.core.doc.credentialSubject.id === wsp.doc.issuer,
  );
  if (op) {
    const orgName = getOrgNameFromOp(op);
    if (orgName) return orgName;
  }
  // WSP名のフォールバック
  if ("name" in wsp.doc.credentialSubject) {
    return wsp.doc.credentialSubject.name;
  }
  return undefined;
};

export const getDestinationOrgName = (
  decodedOps: DecodedOp[],
  decodedWsps: ReturnType<typeof decodeWsps>,
  targetOpId: string,
): string | undefined => {
  // targetOpIdに一致するWSPを検索
  const matchedWsp = decodedWsps.find((wsp) => wsp.doc.issuer === targetOpId);

  if (matchedWsp) {
    return resolveName(matchedWsp, decodedOps);
  }

  // フォールバック: 一致するものがなければ先頭のWSPから取得を試みる
  if (decodedWsps.length > 0) {
    const firstWsp = decodedWsps[0];
    if (firstWsp) {
      return resolveName(firstWsp, decodedOps);
    }
  }

  return undefined;
};

export const isMatched = (
  decodedWsps: ReturnType<typeof decodeWsps>,
  targetOpId: string,
): boolean => {
  return decodedWsps.some((wsp) => wsp.doc.issuer === targetOpId);
};

/**
 * OP検証エラー時の結果オブジェクトを生成する
 * @param context - 検証コンテキスト
 * @param error - 発生したエラー
 */
export const createErrorResult = (
  { targetOpId, sourceOrgName, expectedOrgName }: VerificationContext,
  error: Error,
): LinkVerificationResult => {
  return {
    status: "error",
    expectedOpId: targetOpId,
    sourceOrgName,
    expectedOrgName,
    reason:
      import.meta.env.MODE === "development"
        ? chrome.i18n.getMessage("Verification_InvalidOpsDetail", error.message)
        : chrome.i18n.getMessage("Verification_InvalidOps"),
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
 * タブのクレデンシャルを取得し、OPID検証結果を返す
 * @param tabId - 検証対象のタブID
 * @param context - 検証コンテキスト
 */
export const getVerificationResult = async (
  tabId: number,
  context: VerificationContext,
): Promise<LinkVerificationResult> => {
  const { targetOpId, sourceOrgName, expectedOrgName } = context;
  try {
    const { ops } = await fetchTabCredentials(tabId);
    const { result: sp } = await fetchTabSiteProfile(tabId);
    const decodedOps = decodeOps(ops);
    const decodedWsps = decodeWsps(sp);

    if (decodedOps instanceof Error) {
      return createErrorResult(context, decodedOps);
    }

    // SPが不正な場合はエラーとせず、不一致/未設定として扱う

    const matched = isMatched(decodedWsps, targetOpId);

    const destinationOrgName = getDestinationOrgName(
      decodedOps,
      decodedWsps,
      targetOpId,
    );

    if (matched) {
      return {
        status: "matched",
        expectedOpId: targetOpId,
        sourceOrgName,
        expectedOrgName,
        destinationOrgName,
      };
    }

    const isMissing = decodedWsps.length === 0;
    return createMismatchResult({
      targetOpId,
      sourceOrgName,
      expectedOrgName,
      destinationOrgName,
      isMissing,
    });
  } catch (e: unknown) {
    const reason = chrome.i18n.getMessage("Verification_FetchFailed");
    return {
      status: "error",
      expectedOpId: targetOpId,
      sourceOrgName,
      expectedOrgName,
      reason,
    };
  }
};
