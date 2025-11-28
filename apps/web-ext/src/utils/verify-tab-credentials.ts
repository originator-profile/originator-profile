import {
  OpsVerifier,
  OpsInvalid,
  OpsVerifyFailed,
  verifyCas,
  CasVerifyFailed,
} from "@originator-profile/verify";
import { getRegistryKeys } from "./get-registry-keys";
import {
  fetchTabCredentials,
  FrameIntegrityVerifier,
} from "../components/credentials/messaging";
import type { SupportedCa, SupportedVerifiedCas } from "../components/credentials/types";

/**
 * タブのクレデンシャルを検証する
 * @param tabId タブID
 * @returns 検証済みCASとその件数、または null（検証失敗時）
 */
export async function verifyTabCredentials(tabId: number): Promise<{
  verifiedCas: SupportedVerifiedCas;
  count: number;
} | null> {
  try {
    const { ops, cas, url, frameId } = await fetchTabCredentials(tabId);

    // OPS 検証
    const [issuer, keys] = getRegistryKeys();
    const opsVerifier = OpsVerifier(
      [...import.meta.env.REGISTRY_OPS, ...ops],
      keys,
      issuer,
    );
    const verifiedOps = await opsVerifier();

    if (
      verifiedOps instanceof OpsInvalid ||
      verifiedOps instanceof OpsVerifyFailed
    ) {
      // OPS 検証失敗
      return null;
    }

    // CAS 検証
    const verifiedCas = await verifyCas<SupportedCa>(
      cas,
      verifiedOps,
      url,
      FrameIntegrityVerifier(tabId, frameId),
    );

    if (verifiedCas instanceof CasVerifyFailed) {
      // CAS 検証失敗
      return null;
    }

    return {
      verifiedCas,
      count: verifiedCas.length,
    };
  } catch (error) {
    console.error("Failed to verify tab credentials:", error);
    return null;
  }
}
