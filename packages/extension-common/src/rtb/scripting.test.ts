import { Window } from "happy-dom";
import { expect, test } from "vitest";
import { getBidResponses } from "./bidresponse";

test("getJsonLdNodeObjects()はchrome.scripting ScriptInjectionで使用しているのでシリアル化して呼び出せなければならない", () => {
  /* eslint-disable-next-line @typescript-eslint/no-implied-eval */
  const func = new Function(
    "document",
    `${getBidResponses.toString()}\ngetBidResponses(document);`,
  );
  const window = new Window();
  expect(() => func(window.document)).not.toThrowError();
});
