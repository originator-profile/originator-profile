import { expect, test } from "vitest";
import { CaClientErrorCode } from "../errors.ts";
import { compareTargets } from "./compare.ts";
import { extractTargetsFromHtml } from "./html.ts";

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

const jwtOf = (target: Array<Record<string, string>>) => {
  const b64u = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${b64u({ alg: "none", typ: "JWT" })}.${b64u({ target })}.signature`;
};

test("compareTargets: returns ok when CA targets match the current HTML", async () => {
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
    compareTargets({
      html,
      jwt: jwtOf([{ type: "TextTargetIntegrity", cssSelector, integrity }]),
    }),
  ).resolves.toEqual({ status: "ok" });
});

test("compareTargets: recomputes with the CA-recorded selector, not CIP defaults", async () => {
  const html = `
    <main>
      <h1 itemprop="headline">News</h1>
      <div itemprop="articleBody">List body</div>
    </main>
  `;
  const integrity = await extractTextIntegrity(html, "main");

  await expect(
    compareTargets({
      html,
      jwt: jwtOf([
        { type: "TextTargetIntegrity", cssSelector: "main", integrity },
      ]),
    }),
  ).resolves.toEqual({ status: "ok" });
});

test("compareTargets: matches when selectors include :nth-child", async () => {
  const html = `
    <article>
      <p>First</p>
      <p>Second</p>
    </article>
  `;
  const firstSelector = "article p:nth-child(1)";
  const secondSelector = "article p:nth-child(2)";

  await expect(
    compareTargets({
      html,
      jwt: jwtOf([
        {
          type: "TextTargetIntegrity",
          cssSelector: secondSelector,
          integrity: await extractTextIntegrity(html, secondSelector),
        },
        {
          type: "TextTargetIntegrity",
          cssSelector: firstSelector,
          integrity: await extractTextIntegrity(html, firstSelector),
        },
      ]),
    }),
  ).resolves.toEqual({ status: "ok" });
});

test("compareTargets: returns drifted with current and expected when a text target has drifted", async () => {
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
    compareTargets({
      html,
      jwt: jwtOf([
        { type: "TextTargetIntegrity", cssSelector, integrity: "sha256-stale" },
      ]),
    }),
  ).resolves.toEqual({
    status: "drifted",
    current: [{ type: "TextTargetIntegrity", cssSelector, integrity }],
    expected: [
      { type: "TextTargetIntegrity", cssSelector, integrity: "sha256-stale" },
    ],
  });
});

test("compareTargets: returns drifted when .target-integrity values differ", async () => {
  const html = `
    <article>
      <div itemprop="articleBody">
        <img class="target-integrity" integrity="sha256-new" src="/test.png" />
      </div>
    </article>
  `;
  const cssSelector = "article [itemprop='articleBody']";
  const integrity = await extractTextIntegrity(html, cssSelector);

  await expect(
    compareTargets({
      html,
      jwt: jwtOf([
        { type: "TextTargetIntegrity", cssSelector, integrity },
        { type: "ExternalResourceTargetIntegrity", integrity: "sha256-old" },
      ]),
    }),
  ).resolves.toMatchObject({ status: "drifted" });
});

test("compareTargets: extracts external resources from non-CIP markup via externalSelector", async () => {
  const html = `
    <main>Body</main>
    <img class="op-resource" integrity="sha256-img" src="/a.png" />
  `;
  const integrity = await extractTextIntegrity(html, "main");

  await expect(
    compareTargets({
      html,
      jwt: jwtOf([
        { type: "TextTargetIntegrity", cssSelector: "main", integrity },
        { type: "ExternalResourceTargetIntegrity", integrity: "sha256-img" },
      ]),
      externalSelector: ".op-resource",
    }),
  ).resolves.toEqual({ status: "ok" });
});

test("compareTargets: uses every cssSelector recorded on the CA external targets", async () => {
  const html = `
    <main>Body</main>
    <img class="img-hero" integrity="sha256-hero" src="/hero.png" />
    <img class="img-sidebar" integrity="sha256-sidebar" src="/side.png" />
  `;
  const integrity = await extractTextIntegrity(html, "main");

  await expect(
    compareTargets({
      html,
      jwt: jwtOf([
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

test("compareTargets: returns html_no_targets when the current HTML has no targets", async () => {
  await expect(
    compareTargets({
      html: `<article>body only, without itemprop</article>`,
      jwt: jwtOf([
        {
          type: "TextTargetIntegrity",
          cssSelector: "main",
          integrity: "sha256-xxx",
        },
      ]),
    }),
  ).resolves.toEqual({ status: "html_no_targets" });
});

test("compareTargets: falls back to the textSelector option when the CA has no cssSelector", async () => {
  const html = `<main>Main text</main>`;
  const jwt = jwtOf([
    {
      type: "TextTargetIntegrity",
      integrity: await extractTextIntegrity(html, "main"),
    },
  ]);

  await expect(compareTargets({ html, jwt })).resolves.toEqual({
    status: "html_no_targets",
  });
  await expect(
    compareTargets({ html, jwt, textSelector: "main" }),
  ).resolves.toEqual({ status: "ok" });
});

test("compareTargets: rejects a JWT that cannot be decoded", async () => {
  await expect(
    compareTargets({ html: "<main>x</main>", jwt: "not-a-jwt" }),
  ).rejects.toMatchObject({
    name: "CaClientError",
    code: CaClientErrorCode.Validation,
  });
});
