export class Overlay {
  private iframe: HTMLIFrameElement;
  activate() {
    if (!document.contains(this.iframe)) document.body.appendChild(this.iframe);
  }
  deactivate() {
    this.iframe.remove();
  }
  constructor() {
    this.iframe = document.createElement("iframe");
    this.iframe.srcdoc = `
      <!doctype html>
      <html>
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
      outilne: 0;
      z-index: calc(infinity);
  `;
  }
  get window() {
    return this.iframe.contentWindow;
  }
}
