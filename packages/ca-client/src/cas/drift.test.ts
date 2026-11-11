import { expect, test } from "vitest";
import { extractTargetsFromHtml } from "../targets/html";
import { targetDrift } from "./drift";

const extractTextIntegrity = async (
  html: string,
  cssSelector: string,
): Promise<string> => {
  const targets = await extractTargetsFromHtml(html, {
    textSelectors: [cssSelector],
    externalSelectors: [":not(*)"],
  });
  const integrity = targets[0]?.integrity;
  if (integrity === undefined) {
    throw new Error("expected at least one extracted target");
  }
  return integrity;
};

const payload = (targets: Array<Record<string, string>>) => ({
  target: targets,
});

test("targetDrift: returns ok when CAS targets match the current HTML", async () => {
  const html = `
    <article>
      <h1 itemprop="headline">About</h1>
      <div itemprop="articleBody">Same body</div>
    </article>
  `;
  const cssSelector =
    "article [itemprop='headline'], article [itemprop='articleBody']";
  const integrity = await extractTextIntegrity(html, cssSelector);

  await expect(
    targetDrift({
      html,
      payload: payload([
        { type: "TextTargetIntegrity", cssSelector, integrity },
      ]),
    }),
  ).resolves.toEqual({ status: "ok" });
});

test("targetDrift: recomputes with the CAS-recorded selector, not CIP defaults", async () => {
  const html = `
    <main>
      <h1 itemprop="headline">News</h1>
      <div itemprop="articleBody">List body</div>
    </main>
  `;
  const cssSelector = "main";
  const integrity = await extractTextIntegrity(html, cssSelector);

  await expect(
    targetDrift({
      html,
      payload: payload([
        { type: "TextTargetIntegrity", cssSelector, integrity },
      ]),
    }),
  ).resolves.toEqual({ status: "ok" });
});

test("targetDrift: matches CAS against current HTML when selectors include :nth-child", async () => {
  const html = `
    <article>
      <p>First</p>
      <p>Second</p>
    </article>
  `;
  const firstSelector = "article p:nth-child(1)";
  const secondSelector = "article p:nth-child(2)";
  const firstIntegrity = await extractTextIntegrity(html, firstSelector);
  const secondIntegrity = await extractTextIntegrity(html, secondSelector);

  await expect(
    targetDrift({
      html,
      payload: payload([
        {
          type: "TextTargetIntegrity",
          cssSelector: secondSelector,
          integrity: secondIntegrity,
        },
        {
          type: "TextTargetIntegrity",
          cssSelector: firstSelector,
          integrity: firstIntegrity,
        },
      ]),
    }),
  ).resolves.toEqual({ status: "ok" });
});

test("targetDrift: returns drifted with current and expected when a text target has drifted", async () => {
  const html = `
    <article>
      <h1 itemprop="headline">Privacy</h1>
      <div itemprop="articleBody">Updated body</div>
    </article>
  `;
  const cssSelector =
    "article [itemprop='headline'], article [itemprop='articleBody']";
  const integrity = await extractTextIntegrity(html, cssSelector);

  await expect(
    targetDrift({
      html,
      payload: payload([
        {
          type: "TextTargetIntegrity",
          cssSelector,
          integrity: "sha256-stale",
        },
      ]),
    }),
  ).resolves.toEqual({
    status: "drifted",
    current: [{ type: "TextTargetIntegrity", cssSelector, integrity }],
    expected: [
      {
        type: "TextTargetIntegrity",
        cssSelector,
        integrity: "sha256-stale",
      },
    ],
  });
});

test("targetDrift: returns drifted when .target-integrity values differ", async () => {
  const html = `
    <article>
      <h1 itemprop="headline">Message</h1>
      <div itemprop="articleBody">
        <img class="target-integrity" integrity="sha256-new" src="/test.png" />
      </div>
    </article>
  `;
  const cssSelector =
    "article [itemprop='headline'], article [itemprop='articleBody']";
  const integrity = await extractTextIntegrity(html, cssSelector);

  await expect(
    targetDrift({
      html,
      payload: payload([
        { type: "TextTargetIntegrity", cssSelector, integrity },
        { type: "ExternalResourceTargetIntegrity", integrity: "sha256-old" },
      ]),
    }),
  ).resolves.toMatchObject({ status: "drifted" });
});

test("targetDrift: returns ok when the CAS external target records its cssSelector", async () => {
  const html = `
    <main>Body</main>
    <img class="op-resource" integrity="sha256-img" src="/a.png" />
  `;
  const integrity = await extractTextIntegrity(html, "main");

  await expect(
    targetDrift({
      html,
      payload: payload([
        { type: "TextTargetIntegrity", cssSelector: "main", integrity },
        {
          type: "ExternalResourceTargetIntegrity",
          cssSelector: ".op-resource",
          integrity: "sha256-img",
        },
      ]),
    }),
  ).resolves.toEqual({ status: "ok" });
});

test("targetDrift: returns ok when the CAS external targets record different cssSelectors", async () => {
  const html = `
    <main>Body</main>
    <img class="img-hero" integrity="sha256-hero" src="/hero.png" />
    <img class="img-sidebar" integrity="sha256-sidebar" src="/side.png" />
  `;
  const integrity = await extractTextIntegrity(html, "main");

  await expect(
    targetDrift({
      html,
      payload: payload([
        { type: "TextTargetIntegrity", cssSelector: "main", integrity },
        {
          type: "ExternalResourceTargetIntegrity",
          cssSelector: ".img-hero",
          integrity: "sha256-hero",
        },
        {
          type: "ExternalResourceTargetIntegrity",
          cssSelector: ".img-sidebar",
          integrity: "sha256-sidebar",
        },
      ]),
    }),
  ).resolves.toEqual({ status: "ok" });
});

test("targetDrift: returns html_no_targets when the current HTML has no targets", async () => {
  await expect(
    targetDrift({
      html: `<article>body only, without itemprop</article>`,
      payload: payload([
        {
          type: "TextTargetIntegrity",
          cssSelector: "main",
          integrity: "sha256-xxx",
        },
      ]),
    }),
  ).resolves.toEqual({ status: "html_no_targets" });
});

test("targetDrift: returns html_no_targets when a text target has no cssSelector", async () => {
  const html = `<main>Main text</main>`;
  const integrity = await extractTextIntegrity(html, "main");

  await expect(
    targetDrift({
      html,
      payload: payload([{ type: "TextTargetIntegrity", integrity }]),
    }),
  ).resolves.toEqual({ status: "html_no_targets" });
});
