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
  /**
   * 文書のクレデンシャルが変わった (または検証できる状態になった) ことを通知する
   * @param data.restored bfcache から復元されたか
   * @param data.force 保持している結果を再利用しないか
   */
  documentChanged(data: { restored: boolean; force: boolean }): void;
  /** 検証済みの target の入力依存対象が変化したことを通知する */
  inputChanged(data: null): void;
  /** 文書に改めて documentChanged の通知を求める */
  resync(data: ToDocument & { force: boolean }): void;
  /**
   * タブ内の文書の検証を求める
   * @param data.force 保持している結果を再利用しないか
   * @returns 通知を求められた (content script に到達できた) 文書と、タブが
   * 読み込み中か。読み込み中の文書は content script がまだ応答できないことがある
   */
  verifyTab(data: { tabId: number; force: boolean }): {
    reachable: string[];
    loading: boolean;
  };
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
