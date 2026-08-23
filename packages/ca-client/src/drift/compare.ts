import { ContentAttestationSet } from "@originator-profile/model";
import { existsSync, readFileSync } from "node:fs";
import { decodeJwtPayload } from "../auth/jwt";
import { isRecord } from "../is-record";
import {
  DEFAULT_EXTERNAL_SELECTOR,
  extractTargetsFromHtml,
  type ExtractedTarget,
  type ExtractTargetsOptions,
} from "../targets/html";

export type NormalizedTarget = ExtractedTarget;

export type DriftResult =
  | { status: "ok"; casFilePath: string }
  | { status: "cas_missing"; casFilePath: string }
  | { status: "cas_invalid"; casFilePath: string; reason: string }
  | { status: "html_no_targets"; casFilePath: string }
  | {
      status: "drifted";
      casFilePath: string;
      current: NormalizedTarget[];
      expected: NormalizedTarget[];
    };

export type DetectDriftOptions = {
  /** TextTargetIntegrity の CSS セレクタ。CAS に cssSelector が無いとき使う */
  textSelector?: string;
  /** HtmlTargetIntegrity の CSS セレクタ。CAS に cssSelector が無いとき使う */
  htmlSelector?: string;
  /** VisibleTextTargetIntegrity の CSS セレクタ。CAS に cssSelector が無いとき使う */
  visibleTextSelector?: string;
  /**
   * ExternalResourceTargetIntegrity 要素の CSS セレクタ。
   * 省略時は CAS の cssSelector、それも無ければ `.target-integrity`
   */
  externalSelector?: string;
};

type CasTarget = {
  type: string;
  cssSelector?: string;
  integrity: string;
};

const INVALID_CAS_FORMAT =
  "Invalid CAS file format (expected JSON array with JWT string)";

const jwtFromCasItem = (item: unknown): string | undefined => {
  if (typeof item === "string") {
    return item;
  }
  if (isRecord(item) && typeof item.attestation === "string") {
    return item.attestation;
  }
  return undefined;
};

const isCasTarget = (value: unknown): value is CasTarget =>
  isRecord(value) &&
  typeof value.type === "string" &&
  typeof value.integrity === "string";

const normalizeTargets = (targets: unknown): NormalizedTarget[] => {
  if (!Array.isArray(targets)) {
    return [];
  }

  return targets
    .filter(isCasTarget)
    .map((target) =>
      typeof target.cssSelector === "string"
        ? {
            type: target.type,
            integrity: target.integrity,
            cssSelector: target.cssSelector,
          }
        : { type: target.type, integrity: target.integrity },
    )
    .sort((a, b) => {
      const left = `${a.type}:${a.cssSelector ?? ""}:${a.integrity}`;
      const right = `${b.type}:${b.cssSelector ?? ""}:${b.integrity}`;
      return left.localeCompare(right);
    });
};

const areTargetsEqual = (
  currentTargets: NormalizedTarget[],
  casTargets: NormalizedTarget[],
): boolean => {
  if (currentTargets.length !== casTargets.length) {
    return false;
  }

  return currentTargets.every((target, index) => {
    const casTarget = casTargets[index];
    const cssSelectorEqual =
      casTarget?.cssSelector === undefined ||
      target.cssSelector === casTarget.cssSelector;
    return (
      target.type === casTarget?.type &&
      target.integrity === casTarget?.integrity &&
      cssSelectorEqual
    );
  });
};

type ReadCasTargetsResult =
  | { ok: true; targets: NormalizedTarget[] }
  | { ok: false; reason: string };

const readCasTargets = (casFilePath: string): ReadCasTargetsResult => {
  if (!existsSync(casFilePath)) {
    return { ok: false, reason: "CAS file not found" };
  }

  try {
    const casFileContent = readFileSync(casFilePath, "utf-8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(casFileContent);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return { ok: false, reason: detail };
    }

    const cas = ContentAttestationSet.safeParse(parsed);
    if (!cas.success) {
      return { ok: false, reason: INVALID_CAS_FORMAT };
    }

    const jwt = jwtFromCasItem(cas.data[0]);
    if (!jwt) {
      return { ok: false, reason: INVALID_CAS_FORMAT };
    }

    const payload = decodeJwtPayload(jwt);
    return { ok: true, targets: normalizeTargets(payload.target) };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, reason: detail };
  }
};

const selectorsForType = (
  casTargets: NormalizedTarget[],
  type: string,
  fallback?: string,
): string[] => {
  const fromCas = [
    ...new Set(
      casTargets.flatMap((target) =>
        target.type === type && typeof target.cssSelector === "string"
          ? [target.cssSelector]
          : [],
      ),
    ),
  ];
  if (fromCas.length > 0) {
    return fromCas;
  }
  return fallback && fallback.length > 0 ? [fallback] : [];
};

const extractOptionsFromCas = (
  casTargets: NormalizedTarget[],
  options?: DetectDriftOptions,
): ExtractTargetsOptions => ({
  textSelectors: selectorsForType(
    casTargets,
    "TextTargetIntegrity",
    options?.textSelector,
  ),
  htmlSelectors: selectorsForType(
    casTargets,
    "HtmlTargetIntegrity",
    options?.htmlSelector,
  ),
  visibleTextSelectors: selectorsForType(
    casTargets,
    "VisibleTextTargetIntegrity",
    options?.visibleTextSelector,
  ),
  externalSelector:
    options?.externalSelector ??
    casTargets.find(
      (target) => target.type === "ExternalResourceTargetIntegrity",
    )?.cssSelector ??
    DEFAULT_EXTERNAL_SELECTOR,
});

/**
 * CAS payload に記録された cssSelector で現 HTML の target を再計算し、
 * CAS の target との一致（drift の有無）を判定する。
 *
 * `@originator-profile/verify` による暗号検証とは別物。ビルド後 HTML と
 * 既存 CAS 記録の target integrity が一致するかを見る発行パイプライン向け API。
 */
export const detectDrift = async (
  htmlContent: string,
  casFilePath: string,
  options?: DetectDriftOptions,
): Promise<DriftResult> => {
  const casRead = readCasTargets(casFilePath);
  if (!casRead.ok) {
    if (casRead.reason === "CAS file not found") {
      return { status: "cas_missing", casFilePath };
    }
    return { status: "cas_invalid", casFilePath, reason: casRead.reason };
  }

  const casTargets = casRead.targets;
  const currentTargets = normalizeTargets(
    await extractTargetsFromHtml(
      htmlContent,
      extractOptionsFromCas(casTargets, options),
    ),
  );

  if (currentTargets.length === 0) {
    return { status: "html_no_targets", casFilePath };
  }

  if (!areTargetsEqual(currentTargets, casTargets)) {
    return {
      status: "drifted",
      casFilePath,
      current: currentTargets,
      expected: casTargets,
    };
  }

  return { status: "ok", casFilePath };
};
