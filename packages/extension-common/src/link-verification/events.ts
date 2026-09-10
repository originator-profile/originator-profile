import { defineExtensionMessaging } from "@webext-core/messaging";
import type { LinkVerificationResult, OrgRef } from "./types";

type LinkVerificationProtocolMap = {
  adClicked(message: {
    /** リンク元コンテンツを表明した組織 */
    source?: OrgRef;
    /** targetopid が表明する、期待される運営者 */
    expectedOperator: OrgRef;
    /** 新規タブで開かれたクリックか */
    isNewTab?: boolean;
  }): void;
  getVerificationResult(tabId: number): LinkVerificationResult;
};

export const linkVerificationMessenger =
  defineExtensionMessaging<LinkVerificationProtocolMap>();
