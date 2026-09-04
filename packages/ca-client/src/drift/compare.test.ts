import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { resolveCasFilePath, writeCasFile } from "../cas-store/file";
import { CaClientErrorCode } from "../errors";
import { extractTargetsFromHtml } from "../targets/html";
import { detectDrift } from "./compare";

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

const createCasJwt = (payload: Record<string, unknown>) => {
  const header = Buffer.from(
    JSON.stringify({ alg: "none", typ: "JWT" }),
  ).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );
  return `${header}.${encodedPayload}.signature`;
};

const withTempDir = async (run: (dir: string) => Promise<void>) => {
  const dir = await mkdtemp(join(tmpdir(), "ca-client-drift-"));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

const writeCasTargets = async (
  filePath: string,
  targets: Array<Record<string, string>>,
) => {
  await writeCasFile({
    filePath,
    jwt: createCasJwt({ target: targets }),
  });
  return resolveCasFilePath(filePath);
};

test("detectDrift: returns ok when CAS targets match the current HTML", async () => {
  const html = `
    <article>
      <h1 itemprop="headline">About</h1>
      <div itemprop="articleBody">Same body</div>
    </article>
  `;
  const cssSelector =
    "article [itemprop='headline'], article [itemprop='articleBody']";
  const integrity = await extractTextIntegrity(html, cssSelector);

  await withTempDir(async (dir) => {
    const dest = await writeCasTargets(join(dir, "cas", "about.cas.json"), [
      {
        type: "TextTargetIntegrity",
        cssSelector,
        integrity,
      },
    ]);

    await expect(detectDrift({ html, filePath: dest })).resolves.toEqual({
      status: "ok",
      casFilePath: dest,
    });
  });
});

test("detectDrift: recomputes with the CAS-recorded selector, not CIP defaults", async () => {
  const html = `
    <main>
      <h1 itemprop="headline">News</h1>
      <div itemprop="articleBody">List body</div>
    </main>
  `;
  const cssSelector = "main";
  const integrity = await extractTextIntegrity(html, cssSelector);

  await withTempDir(async (dir) => {
    const dest = await writeCasTargets(join(dir, "cas", "news.cas.json"), [
      {
        type: "TextTargetIntegrity",
        cssSelector,
        integrity,
      },
    ]);

    await expect(detectDrift({ html, filePath: dest })).resolves.toEqual({
      status: "ok",
      casFilePath: dest,
    });
  });
});

test("detectDrift: matches CAS against current HTML when selectors include :nth-child", async () => {
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

  await withTempDir(async (dir) => {
    const dest = await writeCasTargets(join(dir, "cas", "nth-child.cas.json"), [
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
    ]);

    await expect(detectDrift({ html, filePath: dest })).resolves.toEqual({
      status: "ok",
      casFilePath: dest,
    });
  });
});

test("detectDrift: returns drifted with current and expected when a text target has drifted", async () => {
  const html = `
    <article>
      <h1 itemprop="headline">Privacy</h1>
      <div itemprop="articleBody">Updated body</div>
    </article>
  `;
  const cssSelector =
    "article [itemprop='headline'], article [itemprop='articleBody']";
  const integrity = await extractTextIntegrity(html, cssSelector);

  await withTempDir(async (dir) => {
    const dest = await writeCasTargets(join(dir, "cas", "privacy.cas.json"), [
      {
        type: "TextTargetIntegrity",
        cssSelector,
        integrity: "sha256-stale",
      },
    ]);

    await expect(detectDrift({ html, filePath: dest })).resolves.toEqual({
      status: "drifted",
      casFilePath: dest,
      current: [
        {
          type: "TextTargetIntegrity",
          cssSelector,
          integrity,
        },
      ],
      expected: [
        {
          type: "TextTargetIntegrity",
          cssSelector,
          integrity: "sha256-stale",
        },
      ],
    });
  });
});

test("detectDrift: returns drifted when .target-integrity values differ", async () => {
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

  await withTempDir(async (dir) => {
    const dest = join(dir, "cas", "chief-director.cas.json");
    await writeCasTargets(dest, [
      {
        type: "TextTargetIntegrity",
        cssSelector,
        integrity,
      },
      {
        type: "ExternalResourceTargetIntegrity",
        integrity: "sha256-old",
      },
    ]);

    await expect(
      detectDrift({
        html,
        filePath: dest,
      }),
    ).resolves.toMatchObject({
      status: "drifted",
    });
  });
});

test("detectDrift: extracts external resources from non-CIP markup via externalSelector", async () => {
  const html = `
    <main>Body</main>
    <img class="op-resource" integrity="sha256-img" src="/a.png" />
  `;
  const integrity = await extractTextIntegrity(html, "main");

  await withTempDir(async (dir) => {
    const dest = await writeCasTargets(
      join(dir, "cas", "custom-external.cas.json"),
      [
        {
          type: "TextTargetIntegrity",
          cssSelector: "main",
          integrity,
        },
        {
          type: "ExternalResourceTargetIntegrity",
          integrity: "sha256-img",
        },
      ],
    );

    await expect(
      detectDrift({
        html,
        filePath: dest,
        externalSelector: ".op-resource",
      }),
    ).resolves.toEqual({
      status: "ok",
      casFilePath: dest,
    });
  });
});

test("detectDrift: returns ok when the CAS external target records its cssSelector", async () => {
  const html = `
    <main>Body</main>
    <img class="op-resource" integrity="sha256-img" src="/a.png" />
  `;
  const integrity = await extractTextIntegrity(html, "main");

  await withTempDir(async (dir) => {
    const dest = await writeCasTargets(
      join(dir, "cas", "external-css-selector.cas.json"),
      [
        {
          type: "TextTargetIntegrity",
          cssSelector: "main",
          integrity,
        },
        {
          type: "ExternalResourceTargetIntegrity",
          cssSelector: ".op-resource",
          integrity: "sha256-img",
        },
      ],
    );

    await expect(
      detectDrift({
        html,
        filePath: dest,
      }),
    ).resolves.toEqual({
      status: "ok",
      casFilePath: dest,
    });
  });
});

test("detectDrift: returns ok when the CAS external targets record different cssSelectors", async () => {
  const html = `
    <main>Body</main>
    <img class="img-hero" integrity="sha256-hero" src="/hero.png" />
    <img class="img-sidebar" integrity="sha256-sidebar" src="/side.png" />
  `;
  const integrity = await extractTextIntegrity(html, "main");

  await withTempDir(async (dir) => {
    const dest = await writeCasTargets(
      join(dir, "cas", "multiple-external-selectors.cas.json"),
      [
        {
          type: "TextTargetIntegrity",
          cssSelector: "main",
          integrity,
        },
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
      ],
    );

    await expect(
      detectDrift({
        html,
        filePath: dest,
      }),
    ).resolves.toEqual({
      status: "ok",
      casFilePath: dest,
    });
  });
});

test("detectDrift: returns cas_missing when the CAS file does not exist", async () => {
  await withTempDir(async (dir) => {
    await mkdir(join(dir, "cas"), { recursive: true });
    const dest = join(dir, "cas", "missing.cas.json");

    await expect(
      detectDrift({
        html: "<main>Body</main>",
        filePath: dest,
      }),
    ).resolves.toEqual({
      status: "cas_missing",
      casFilePath: dest,
    });
  });
});

test("detectDrift: returns html_no_targets when the current HTML has no targets", async () => {
  await withTempDir(async (dir) => {
    const dest = await writeCasTargets(join(dir, "cas", "empty.cas.json"), [
      {
        type: "TextTargetIntegrity",
        cssSelector: "main",
        integrity: "sha256-xxx",
      },
    ]);

    await expect(
      detectDrift({
        html: `<article>body only, without itemprop</article>`,
        filePath: dest,
      }),
    ).resolves.toEqual({
      status: "html_no_targets",
      casFilePath: dest,
    });
  });
});

test("detectDrift: returns cas_invalid when the CAS is invalid", async () => {
  await withTempDir(async (dir) => {
    await mkdir(join(dir, "cas"), { recursive: true });

    const notJson = join(dir, "cas", "not-json.cas.json");
    await writeFile(notJson, "{", "utf8");
    await expect(
      detectDrift({
        html: "<main>x</main>",
        filePath: notJson,
      }),
    ).resolves.toMatchObject({
      status: "cas_invalid",
      casFilePath: notJson,
    });

    const notArray = join(dir, "cas", "object.cas.json");
    await writeFile(notArray, JSON.stringify({ attestation: "x" }), "utf8");
    await expect(
      detectDrift({
        html: "<main>x</main>",
        filePath: notArray,
      }),
    ).resolves.toEqual({
      status: "cas_invalid",
      casFilePath: notArray,
      reason: "Invalid CAS file format (expected JSON array with JWT string)",
    });

    const badJwt = join(dir, "cas", "bad-jwt.cas.json");
    await writeFile(badJwt, JSON.stringify(["not-a-jwt"]), "utf8");
    await expect(
      detectDrift({
        html: "<main>x</main>",
        filePath: badJwt,
      }),
    ).resolves.toMatchObject({
      status: "cas_invalid",
      casFilePath: badJwt,
    });
  });
});

test("detectDrift: reads a CAS in { main, attestation } form", async () => {
  const html = `<main>Body</main>`;
  const integrity = await extractTextIntegrity(html, "main");

  await withTempDir(async (dir) => {
    await mkdir(join(dir, "cas"), { recursive: true });
    const dest = join(dir, "cas", "wrapped.cas.json");
    const jwt = createCasJwt({
      target: [
        {
          type: "TextTargetIntegrity",
          cssSelector: "main",
          integrity,
        },
      ],
    });
    await writeFile(
      dest,
      `${JSON.stringify([{ main: true, attestation: jwt }], null, 2)}\n`,
      "utf8",
    );

    await expect(detectDrift({ html, filePath: dest })).resolves.toEqual({
      status: "ok",
      casFilePath: dest,
    });
  });
});

test("detectDrift: evaluates HTML with the textSelector option when CAS has no cssSelector", async () => {
  const html = `<main>Main text</main>`;
  const integrity = await extractTextIntegrity(html, "main");

  await withTempDir(async (dir) => {
    const dest = await writeCasTargets(
      join(dir, "cas", "fallback-selector.cas.json"),
      [
        {
          type: "TextTargetIntegrity",
          integrity,
        },
      ],
    );

    await expect(
      detectDrift({
        html,
        filePath: dest,
      }),
    ).resolves.toEqual({
      status: "html_no_targets",
      casFilePath: dest,
    });
    await expect(
      detectDrift({
        html,
        filePath: dest,
        textSelector: "main",
      }),
    ).resolves.toEqual({
      status: "ok",
      casFilePath: dest,
    });
  });
});

test("detectDrift: rejects an empty filePath", async () => {
  await Promise.all(
    ["", "   "].map((filePath) =>
      expect(
        detectDrift({
          html: "<main>x</main>",
          filePath,
        }),
      ).rejects.toMatchObject({
        name: "CaClientError",
        code: CaClientErrorCode.Validation,
        message: "filePath must be a non-empty string",
      }),
    ),
  );
});
