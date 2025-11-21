import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { documentProvider } from "./document-provider.ts";

await describe("documentProvider()", async () => {
  await test("開きタグ省略した非整形式HTMLでブラウザー互換のDOMが得られる", async () => {
    const notWellFormedHtml = `<body>test</p></body>\n`;
    // WHATWG HTML Living Standard [serializing algorithm] より
    // body > p > #text:"" と解釈 (p 要素のコンテンツにテキストノード "" が入る)
    // body>* Chrome v134 => "", Firefox v136 => ""
    // ただし npm:happy-dom@17.4.4 は body>* => null と解釈されるため互換性ない

    const document = await documentProvider({
      type: "TextTargetIntegrity",
      content: notWellFormedHtml,
    });

    assert.equal(document.querySelector("body>*")?.textContent, "");
  });

  await test("閉じタグ省略した非整形式HTMLでブラウザー互換のDOMが得られる", async () => {
    const notWellFormedHtml = `<body><p></body>test\n`;
    // WHATWG HTML Living Standard [serializing algorithm] より
    // body > p > #text:"test\n" と解釈 (p 要素のコンテンツにテキストノード "test\n" が入る)
    // body>* Chrome v134 => "test\n", Firefox v136 => "test\n"
    // ただし npm:happy-dom@17.4.4 は body>* => "" と解釈されるため互換性ない

    const document = await documentProvider({
      type: "TextTargetIntegrity",
      content: notWellFormedHtml,
    });

    assert.equal(document.querySelector("body>*")?.textContent, "test\n");
  });

  await test("ExternalResourceTargetIntegrity 以外の場合 fetch() で取得した DOM が得られる", async () => {
    const document = await documentProvider({
      type: "HtmlTargetIntegrity",
      content: "data:text/html,<body>test</body>",
    });

    assert.equal(
      document.documentElement.outerHTML,
      "<html><head></head><body>test</body></html>",
    );
  });

  await test("ExternalResourceTargetIntegrity は未対応", async () => {
    await assert.rejects(
      async () => {
        await documentProvider({
          type: "ExternalResourceTargetIntegrity",
          content: "data:text/text,content",
        });
      },
      {
        name: "Error",
        message:
          "ExternalResourceTargetIntegrity is not supported in this context.",
      },
    );
  });
});
