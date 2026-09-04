import type {
  ContentAttestationSet,
  OriginatorProfileSet,
} from "@originator-profile/model";
import type { SourcedCredential } from "@originator-profile/presentation";
import {
  CasVerifyFailed,
  type Logger,
  OpsInvalid,
  OpsVerifier,
  OpsVerifyFailed,
  type VerifiedOps,
  type VerifiedSp,
  verifyCas,
} from "@originator-profile/verify";
import { getRegistryOps } from "../../utils/registry-ops";
import { deduplicateCas } from "./deduplicate-cas";
import { FrameIntegrityVerifier } from "./messaging";
import type {
  FrameCredentials,
  OpOrigin,
  SupportedCa,
  SupportedVerifiedCaWithSource,
  SupportedVerifiedCasWithSource,
  TabCredentials,
  VerifiedOpWithSource,
  VerifiedOpsWithSource,
} from "./types";

export const registrySource = (): OpOrigin => ({ kind: "registry" });
export const siteProfileSource = (): OpOrigin => ({ kind: "site-profile" });

/**
 * OPSを検証する。
 * REGISTRY_OPSとページ・フレームのOPSを結合して検証し、
 * Site Profile由来のOriginatorsを追加する。
 */
export async function verifyOps(
  page: { ops: SourcedCredential<OriginatorProfileSet[number]>[] },
  frames: { ops: SourcedCredential<OriginatorProfileSet[number]>[] }[],
  siteProfile?: VerifiedSp | null,
  logger?: Logger,
): Promise<VerifiedOpsWithSource | OpsInvalid | OpsVerifyFailed> {
  const {
    ops: registryOps,
    keys: [cpIssuer, verificationKeys],
  } = await getRegistryOps();

  // registryOps分も含めて1本の配列にまとめる(OpsVerifierへの入力と検証後の
  // 対応付けを同じ配列から作ることで、インデックスのズレを防ぐ)
  // ※ OpsVerifier は内部で Promise.all(ops.map(...)) により検証しており、
  //   要素のフィルタ・並び替え・重複排除を行わないため、入力と同じ順序・
  //   件数の結果を返す(packages/verify/src/originator-profile-set/verify-ops.ts 参照)
  const sourcedOps: {
    credential: OriginatorProfileSet[number];
    source: OpOrigin;
  }[] = [
    ...registryOps.map((credential) => ({
      credential,
      source: registrySource(),
    })),
    ...page.ops,
    ...frames.flatMap((frame) => frame.ops),
  ];

  const opsVerifier = OpsVerifier(
    sourcedOps.map(({ credential }) => credential),
    verificationKeys,
    cpIssuer,
    { logger },
  );
  const verifiedOps = await opsVerifier();

  if (
    verifiedOps instanceof OpsInvalid ||
    verifiedOps instanceof OpsVerifyFailed
  ) {
    return verifiedOps;
  }

  // sourcedOps と同じ配列から作っているため、インデックスがそのまま対応する
  const verifiedOpsWithSource: VerifiedOpWithSource[] = verifiedOps.map(
    (op, i) => {
      const sourced = sourcedOps[i];
      if (!sourced) {
        throw new Error(`sourcedOps[${i}] not found`);
      }
      return { ...op, source: sourced.source };
    },
  );

  const siteOriginators = siteProfile?.originators ?? [];

  return verifiedOpsWithSource.concat(
    siteOriginators.map((op) => ({
      ...op,
      source: siteProfileSource(),
    })),
  );
}

type FrameCasInput = {
  cas: SourcedCredential<ContentAttestationSet[number]>[];
  url: string;
  frameId: number;
};

/**
 * フレームごとにCASを検証する。
 * 各フレームの検証結果とフレーム情報をペアで返す。
 */
export async function verifyFramesCas<F extends FrameCasInput>(
  tabId: number,
  frames: F[],
  verifiedOps: VerifiedOps,
): Promise<
  { result: SupportedVerifiedCasWithSource | CasVerifyFailed; frame: F }[]
> {
  return Promise.all(
    frames.map(async (frame) => {
      const result = await verifyCas<SupportedCa>(
        frame.cas.map(({ credential }) => credential),
        verifiedOps,
        frame.url,
        FrameIntegrityVerifier(tabId, frame.frameId),
      );
      if (result instanceof CasVerifyFailed) {
        return { result, frame };
      }
      // frame.cas と同じ配列(順序)から検証しているため、インデックスがそのまま対応する
      // ※ verifyCas も Promise.all(cas.map(...)) により検証しており、要素の
      //   フィルタ・並び替えを行わないため、入力と同じ順序・件数の結果を返す
      //   (packages/verify/src/content-attestation-set/verify-cas.ts 参照)
      const resultWithSource: SupportedVerifiedCaWithSource[] = result.map(
        (item, i) => {
          const sourced = frame.cas[i];
          if (!sourced) {
            throw new Error(`frame.cas[${i}] not found`);
          }
          return { ...item, source: sourced.source };
        },
      );
      return { result: resultWithSource, frame };
    }),
  );
}

/**
 * タブ内のクレデンシャルを検証する共通関数
 * @param tabId タブID
 * @param page ページ
 * @param frames フレームのリスト
 * @param siteProfile Site Profile
 * @returns
 *    - 成功時: { ops, cas, casResults, warnings, info }
 *    - 失敗時: 検証失敗した結果
 */
export async function verifyAllCredentials(
  tabId: number,
  page: Omit<TabCredentials, "frames">,
  frames: FrameCredentials[],
  siteProfile?: VerifiedSp | null,
) {
  // 検証中の警告・情報を収集する (コンソールへの出力は維持)
  const warnings: string[] = [];
  const info: string[] = [];
  const logger: Logger = {
    warn: (message) => {
      console.warn(message);
      warnings.push(message);
    },
    info: (message) => {
      console.info(message);
      info.push(message);
    },
  };

  // OPS 検証
  const verifiedOps = await verifyOps(page, frames, siteProfile, logger);
  if (
    verifiedOps instanceof OpsInvalid ||
    verifiedOps instanceof OpsVerifyFailed
  ) {
    return verifiedOps;
  }

  // CAS 検証
  const casResults = await verifyFramesCas(
    tabId,
    [page, ...frames],
    verifiedOps,
  );
  const failedCas = casResults.find(
    ({ result }) => result instanceof CasVerifyFailed,
  );
  if (failedCas) {
    return failedCas.result as CasVerifyFailed;
  }

  return {
    ops: verifiedOps,
    cas: deduplicateCas(
      casResults.flatMap(
        ({ result }) => result as SupportedVerifiedCaWithSource[],
      ),
    ),
    casResults,
    warnings,
    info,
  };
}
