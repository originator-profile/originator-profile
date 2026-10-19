import { deserializeIfError, type Serialized } from "@originator-profile/core";
import type {
  ContentAttestationSet,
  OpMeta,
  OriginatorProfileSet,
} from "@originator-profile/model";
import type { FetchCredentialSetResult } from "@originator-profile/presentation";
import type { FrameLocation } from "../credentials/types";
import type { DocumentCredentials } from "./types";

/** 文書が Service Worker に返す、クレデンシャルの取得結果 */
export type FetchCredentialsMessageResponse = FrameLocation & {
  ops: Serialized<FetchCredentialSetResult<OriginatorProfileSet>>;
  cas: Serialized<FetchCredentialSetResult<ContentAttestationSet>>;
  opMeta?: OpMeta;
};

/**
 * 文書から取得したクレデンシャルを、取得経路付きの形に戻す。
 * 取得に失敗した OPS / CAS は空として扱う。
 * @param result 文書での取得結果
 */
export function toDocumentCredentials(
  result: FetchCredentialsMessageResponse,
): DocumentCredentials & FrameLocation {
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
