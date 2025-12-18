import { CertificationSystem, OpCredential } from "@originator-profile/model";
import {
  CertificationSystemValidationFailed,
  validateCertificationSystem,
} from "@originator-profile/verify";
import useSWR from "swr";

async function fetcher(url: string): Promise<CertificationSystem> {
  const response = await fetch(url);
  const payload = await response.json();
  const certificationSystem = validateCertificationSystem(payload);
  if (certificationSystem instanceof CertificationSystemValidationFailed) {
    throw certificationSystem;
  }
  return certificationSystem;
}

/** 認証制度を取得するカスタムフック */
export default function useCertificationSystem(url: OpCredential["url"]) {
  return useSWR(url || null, fetcher);
}
