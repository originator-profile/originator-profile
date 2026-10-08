declare module "*.png";
declare module "*.svg";

// Firefox 専用の sidebarAction API（@types/chrome に含まれない）
declare namespace chrome {
  namespace sidebarAction {
    function open(): Promise<void>;
    function close(): Promise<void>;
    function isOpen(details: { windowId?: number }): Promise<boolean>;
  }
}

// Speculation Rules のプリレンダリング（TypeScript の DOM 型定義に含まれない）
// see https://wicg.github.io/nav-speculation/prerendering.html
interface Document {
  /** Chromium 以外では未定義 */
  readonly prerendering?: boolean;
}
