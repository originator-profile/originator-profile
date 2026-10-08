import type { Target } from "@originator-profile/model";
import type { InputDependency } from "@originator-profile/verify";
import { defineExtensionMessaging } from "@webext-core/messaging";
import type {
  FetchCredentialsMessageResponse,
  SerializedIntegrityVerifyResult,
} from "../credentials/types";
import type { SerializedSiteProfileResult } from "../site-profile/types";

/** 宛先の文書。受け取った文書は自身の documentId と一致しなければ拒否する */
type ToDocument = { documentId: string };

type VerificationProtocolMap = {
  /** 文書の documentId を問い合わせる */
  register(data: null): string | undefined;
  /** 文書のクレデンシャルが変わった (または検証できる状態になった) ことを通知する */
  documentChanged(data: null): void;
  /** 文書に改めて documentChanged の通知を求める */
  resync(data: ToDocument): void;
  fetchDocumentCredentials(data: ToDocument): FetchCredentialsMessageResponse;
  fetchDocumentSiteProfile(data: ToDocument): SerializedSiteProfileResult;
  /** 入力依存対象が検証可能になる時点まで待つ */
  awaitInputDependency(
    data: ToDocument & { dependency: InputDependency },
  ): void;
  verifyDocumentIntegrity(
    data: ToDocument & { content: Target },
  ): SerializedIntegrityVerifyResult;
};

export const verificationMessenger =
  defineExtensionMessaging<VerificationProtocolMap>();
