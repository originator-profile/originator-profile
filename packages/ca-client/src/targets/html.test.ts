import { createIntegrity } from "@originator-profile/sign";
import { JSDOM } from "jsdom";
import { expect, test } from "vitest";
import {
  DEFAULT_EXTERNAL_SELECTOR,
  extractExternalTargetIntegrities,
  extractTargetsFromHtml,
} from "./html";

test("extractTargetsFromHtml: uses the given selector, not CIP itemprop defaults", async () => {
  const html = `
    <article>
      <h1 itemprop="headline">Headline</h1>
      <div itemprop="articleBody">Body</div>
      <main>Main text</main>
    </article>
  `;

  const fromMain = await extractTargetsFromHtml(html, {
    textSelectors: ["main"],
    externalSelector: ":not(*)",
  });
  const fromItemprop = await extractTargetsFromHtml(html, {
    textSelectors: [
      "article [itemprop='headline'], article [itemprop='articleBody']",
    ],
    externalSelector: ":not(*)",
  });

  expect(fromMain).toHaveLength(1);
  expect(fromItemprop).toHaveLength(1);
  expect(fromMain[0]?.cssSelector).toBe("main");
  expect(fromItemprop[0]?.cssSelector).toBe(
    "article [itemprop='headline'], article [itemprop='articleBody']",
  );
  expect(fromMain[0]?.integrity).not.toBe(fromItemprop[0]?.integrity);
});

test("extractTargetsFromHtml: returns empty when the selector matches nothing", async () => {
  const html = `
    <article>
      <h1 itemprop="headline">Headline</h1>
      <div itemprop="articleBody">Body</div>
    </article>
  `;

  expect(
    await extractTargetsFromHtml(html, {
      textSelectors: ["main"],
      externalSelector: ":not(*)",
    }),
  ).toEqual([]);
});

test("extractTargetsFromHtml: matches createIntegrity for TextTargetIntegrity", async () => {
  const html = `<html><body><main>Hello, world!</main></body></html>`;
  const cssSelector = "main";
  const document = new JSDOM(html).window.document;
  const canonical = await createIntegrity(
    "sha256",
    { type: "TextTargetIntegrity", cssSelector },
    document,
  );

  const extracted = await extractTargetsFromHtml(html, {
    textSelectors: [cssSelector],
    externalSelector: ":not(*)",
  });

  expect(extracted).toEqual([
    {
      type: "TextTargetIntegrity",
      cssSelector,
      integrity: canonical?.integrity,
    },
  ]);
});

test("extractExternalTargetIntegrities: uses the given selector", () => {
  const html = `
    <img class="target-integrity" integrity="sha256-default" src="/a.png" />
    <img class="my-resource" integrity="sha256-custom" src="/b.png" />
  `;
  const document = new JSDOM(html).window.document;

  expect(extractExternalTargetIntegrities(document)).toEqual([
    {
      type: "ExternalResourceTargetIntegrity",
      integrity: "sha256-default",
      cssSelector: DEFAULT_EXTERNAL_SELECTOR,
    },
  ]);
  expect(extractExternalTargetIntegrities(document, ".my-resource")).toEqual([
    {
      type: "ExternalResourceTargetIntegrity",
      integrity: "sha256-custom",
      cssSelector: ".my-resource",
    },
  ]);
  expect(DEFAULT_EXTERNAL_SELECTOR).toBe(".target-integrity");
});
