import { deserializeIfError } from "@originator-profile/core";
import type { FetchCredentialsMessageResponse } from "./types";

/**
 * 文書から取得したクレデンシャルを、取得経路付きの形に戻す。
 * 取得に失敗した OPS / CAS は空として扱う。
 * @param result 文書での取得結果
 */
export function toDocumentCredentials(result: FetchCredentialsMessageResponse) {
  const opsResult = deserializeIfError(result.ops);
  const casResult = deserializeIfError(result.cas);

  return {
    ops: opsResult instanceof Error ? [] : opsResult,
    cas: casResult instanceof Error ? [] : casResult,
    opMeta: result.opMeta,
    url: result.url,
    origin: result.origin,
  };
}
