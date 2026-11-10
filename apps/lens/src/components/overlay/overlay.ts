import { uiLocale } from "../../utils/ui-locale";

export class Overlay {
  private iframe: HTMLIFrameElement;
  activate() {
    if (!document.contains(this.iframe)) document.body.appendChild(this.iframe);
  }
  deactivate() {
    this.iframe.remove();
  }
  get active() {
    return document.contains(this.iframe);
  }
  constructor() {
    this.iframe = document.createElement("iframe");
    // NOTE: 強調とタグはサイドパネルの内容の複製なので、フォーカスも支援技術も
    // 向けない。pointer-events: none はマウスにしか効かない
    this.iframe.inert = true;
    this.iframe.srcdoc = `
      <!doctype html>
      <html lang='${uiLocale()}'>
        <head>
          <link rel='stylesheet' href='${chrome.runtime.getURL("main.css")}'>
        </head>
        <body>
          <script src='${chrome.runtime.getURL("content-script/iframe.js")}'></script>
        </body>
      </html>
    `;
    this.iframe.style.cssText = `
      background: transparent;
      border-radius: 0;
      border: none;
      box-shadow: none;
      display: block;
      width: 100vw;
      height: 100vh;
      position: fixed;
      top: 0;
      left: 0;
      margin: 0;
      padding: 0;
      opacity: 1;
      visibility: visible;
      outline: 0;
      z-index: calc(infinity);
      pointer-events: none;
  `;
  }
  get window() {
    return this.iframe.contentWindow;
  }
}
