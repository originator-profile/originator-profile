import { Target } from "@originator-profile/model";
import { expect, test } from "@playwright/test";
import { createIntegrityMetadata } from "websri";
import { IntegrityVerifyResult } from "../src";

// see playwright/index.ts
declare const verifyIntegrity: (
  content: Target,
) => Promise<IntegrityVerifyResult>;

test("verifyIntegrity() should verify HtmlTargetIntegrity", async function ({
  page,
}) {
  await page.goto("/");

  const integrityMetadata = await createIntegrityMetadata(
    "sha256",
    await new Response(
      `<p>Hello, World!</p><p class="display-none">Goodbye, World!</p>`,
    ).arrayBuffer(),
  );

  const content: Target = {
    type: "HtmlTargetIntegrity",
    cssSelector: "p",
    integrity: integrityMetadata.toString(),
  };

  const handle = await page.evaluateHandle(
    (content) => verifyIntegrity(content),
    content,
  );

  expect((await handle.jsonValue()).valid).toBe(true);
});

test("verifyIntegrity() should verify TextTargetIntegrity", async function ({
  page,
}) {
  await page.goto("/");

  const integrityMetadata = await createIntegrityMetadata(
    "sha256",
    await new Response(`Hello, World!Goodbye, World!`).arrayBuffer(),
  );

  const content: Target = {
    type: "TextTargetIntegrity",
    cssSelector: "p",
    integrity: integrityMetadata.toString(),
  };

  const handle = await page.evaluateHandle(
    (content) => verifyIntegrity(content),
    content,
  );

  expect((await handle.jsonValue()).valid).toBe(true);
});

test("verifyIntegrity() should verify VisibleTextTargetIntegrity", async function ({
  browserName,
  page,
}) {
  await page.goto("/");

  const integrityMetadata = await createIntegrityMetadata(
    "sha256",
    await new Response(
      // https://github.com/originator-profile/originator-profile/issues/64
      `Hello, World!${browserName === "webkit" ? "\n\n" : ""}`,
    ).arrayBuffer(),
  );

  const content: Target = {
    type: "VisibleTextTargetIntegrity",
    cssSelector: "body",
    integrity: integrityMetadata.toString(),
  };

  const handle = await page.evaluateHandle(
    (content) => verifyIntegrity(content),
    content,
  );

  expect((await handle.jsonValue()).valid).toBe(true);
});

test("verifyIntegrity() should verify ExternalResourceTargetIntegrity", async function ({
  page,
}) {
  await page.goto("/");

  const content: Target = {
    type: "ExternalResourceTargetIntegrity",
    integrity: "sha256-P0hnTtzozTl+5h4CpQdOK+5dwpuINHNaZEahrlrNkSQ=",
  };

  const handle = await page.evaluateHandle(
    (content) => verifyIntegrity(content),
    content,
  );

  expect((await handle.jsonValue()).valid).toBe(true);
});
