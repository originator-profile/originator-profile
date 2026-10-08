import { setupDocumentVerification } from "./verification/content-script";

export { setupAdClickDetection } from "./link-verification/detect-ad-click";
export { setupOnce } from "./setup-once";

/**
 * 全フレームで登録するハンドラ
 *
 * 文書の検証を Service Worker に委ね、その要求に応える。
 */
export function setupFrameHandlers() {
  setupDocumentVerification();
}
