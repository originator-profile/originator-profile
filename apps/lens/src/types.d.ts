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
