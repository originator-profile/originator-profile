import {
  fetchCredentials,
  fetchSiteProfile,
} from "@originator-profile/presentation";
import { VerifiedOps } from "@originator-profile/verify";
import dotenv from "dotenv";
import { decodeRegistry } from "../decode/decode-registry.js";
import { buildVerificationDocument, prepareHtml } from "../fetch/fetch-html.js";
import { CasMonitorVerificationResult } from "../types.js";
import { runCasVerification } from "./cas-verification.js";
import { runOpsVerification } from "./ops-verification.js";
import { runSpVerification } from "./sp-verification.js";

dotenv.config();

export async function runVerificationPipeline(url: string) {
  const result: CasMonitorVerificationResult = {
    registryOpsResult: null,
    fetchHtmlResult: null,
    spResult: null,
    opsResult: null,
    casResult: null,
  };
  // REGISTRY_OPS を取得
  const registryOps = await decodeRegistry(process.env.REGISTRY_OPS ?? "");
  result.registryOpsResult = registryOps;
  if (registryOps instanceof Error) return result;

  // HTML の取得
  const html = await prepareHtml(url);
  result.fetchHtmlResult = html;
  if (html instanceof Error) return result;

  // Document の生成
  const doc = buildVerificationDocument(html, url);

  // SP/OPS/CAS の取得
  const sp = await fetchSiteProfile(doc);
  const { ops, cas } = await fetchCredentials(doc);

  const verifiedOps: VerifiedOps = [];

  // SP/OPS/CAS の検証
  if (!(sp instanceof Error)) {
    const spResult = await runSpVerification(sp.result, registryOps, url);
    result.spResult = spResult;

    if (!(spResult instanceof Error)) {
      verifiedOps.push(...spResult.originators);
    }
  } else {
    result.spResult = sp;
  }
  if (!(ops instanceof Error)) {
    const opsResult = await runOpsVerification(
      ops.map((ops) => ops.credential),
      registryOps,
    );
    result.opsResult = opsResult;

    if (!(opsResult instanceof Error)) {
      verifiedOps.push(...opsResult);
    }
  } else {
    result.opsResult = ops;
  }

  if (!(cas instanceof Error)) {
    const casResult = await runCasVerification(
      cas.map((cas) => cas.credential),
      verifiedOps,
      url,
      doc,
    );
    result.casResult = casResult;
  } else {
    result.casResult = cas;
  }

  return result;
}
