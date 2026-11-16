import type { VcValidatorFactory } from "@originator-profile/securing-mechanism";
import type { Logger } from "../logger";
import { OpsVerifier } from "../originator-profile-set";
import { collectProblems } from "../result/collect-problems";
import {
  convertOps,
  createCollector,
  type OriginatorPayload,
} from "../result/convert";
import { toProblemDetails } from "../result/to-problem-details";
import type { VerificationResult } from "../result/types";
import type { Registry } from "./prepare-registry";

/** 発信者の検証結果に含まれる復号ペイロード */
export type OriginatorsOutcome = {
  /** 発信者ごとの復号ペイロード */
  originators: OriginatorPayload[];
};

/**
 * レジストリの検証
 *
 * レジストリの Originator Profile Set を検証する。結果は文書の検証で
 * 共有の発信者として用いる。
 * @param registry Core Profile 発行者のレジストリ
 * @param options バリデーター・ロガー
 * @returns 検証結果。復号できたペイロードは status によらず outcome に含まれる
 */
export async function verifyRegistry(
  registry: Registry,
  options: {
    /** バリデーター */
    validator?: VcValidatorFactory;
    /** ロガー (デフォルト: `console`) */
    logger?: Logger;
  } = {},
): Promise<VerificationResult<OriginatorsOutcome>> {
  const {
    logger: collecting,
    warnings,
    info,
  } = collectProblems(options.logger);
  const collect = createCollector();
  const verifiedOps = await OpsVerifier(
    registry.ops,
    registry.keys,
    registry.issuer,
    { validator: options.validator, logger: collecting },
  )();
  const outcome = { originators: convertOps(verifiedOps, collect) };

  return verifiedOps instanceof Error
    ? {
        status: false,
        outcome,
        securingResults: collect.securingResults,
        warnings,
        info,
        errors: [toProblemDetails(verifiedOps), ...collect.errors],
      }
    : {
        status: true,
        outcome,
        securingResults: collect.securingResults,
        warnings,
        info,
      };
}
