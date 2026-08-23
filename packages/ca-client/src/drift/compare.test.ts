import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { casFilePath, writeCasFile } from "../cas-store/file";
import { CaClientErrorCode } from "../errors";
import { extractTargetsFromHtml } from "../targets/html";
import { detectDrift } from "./compare";

const extractTextIntegrity = async (
  html: string,
  cssSelector: string,
): Promise<string> => {
  const targets = await extractTargetsFromHtml(html, {
    textSelectors: [cssSelector],
    externalSelector: ":not(*)",
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
  outputDir: string,
  fileName: string,
  targets: Array<Record<string, string>>,
) => {
  await writeCasFile({
    fileName,
    jwt: createCasJwt({ target: targets }),
    outputDir,
  });
  return casFilePath({ fileName, outputDir });
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
    const outputDir = join(dir, "cas");
    const dest = await writeCasTargets(outputDir, "about.cas.json", [
      {
        type: "TextTargetIntegrity",
        cssSelector,
        integrity,
      },
    ]);

    await expect(
      detectDrift({ html, fileName: "about.cas.json", outputDir }),
    ).resolves.toEqual({
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
    const outputDir = join(dir, "cas");
    const dest = await writeCasTargets(outputDir, "news.cas.json", [
      {
        type: "TextTargetIntegrity",
        cssSelector,
        integrity,
      },
    ]);

    await expect(
      detectDrift({ html, fileName: "news.cas.json", outputDir }),
    ).resolves.toEqual({
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
    const outputDir = join(dir, "cas");
    const dest = await writeCasTargets(outputDir, "nth-child.cas.json", [
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

    await expect(
      detectDrift({ html, fileName: "nth-child.cas.json", outputDir }),
    ).resolves.toEqual({
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
    const outputDir = join(dir, "cas");
    const dest = await writeCasTargets(outputDir, "privacy.cas.json", [
      {
        type: "TextTargetIntegrity",
        cssSelector,
        integrity: "sha256-stale",
      },
    ]);

    await expect(
      detectDrift({ html, fileName: "privacy.cas.json", outputDir }),
    ).resolves.toEqual({
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
    const outputDir = join(dir, "cas");
    await writeCasTargets(outputDir, "chief-director.cas.json", [
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
        fileName: "chief-director.cas.json",
        outputDir,
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
    const outputDir = join(dir, "cas");
    const dest = await writeCasTargets(outputDir, "custom-external.cas.json", [
      {
        type: "TextTargetIntegrity",
        cssSelector: "main",
        integrity,
      },
      {
        type: "ExternalResourceTargetIntegrity",
        integrity: "sha256-img",
      },
    ]);

    await expect(
      detectDrift({
        html,
        fileName: "custom-external.cas.json",
        outputDir,
        externalSelector: ".op-resource",
      }),
    ).resolves.toEqual({
      status: "ok",
      casFilePath: dest,
    });
  });
});

test("detectDrift: returns cas_missing when the CAS file does not exist", async () => {
  await withTempDir(async (dir) => {
    const outputDir = join(dir, "cas");
    await mkdir(outputDir, { recursive: true });
    const dest = casFilePath({ fileName: "missing.cas.json", outputDir });

    await expect(
      detectDrift({
        html: "<main>Body</main>",
        fileName: "missing.cas.json",
        outputDir,
      }),
    ).resolves.toEqual({
      status: "cas_missing",
      casFilePath: dest,
    });
  });
});

test("detectDrift: returns html_no_targets when the current HTML has no targets", async () => {
  await withTempDir(async (dir) => {
    const outputDir = join(dir, "cas");
    const dest = await writeCasTargets(outputDir, "empty.cas.json", [
      {
        type: "TextTargetIntegrity",
        cssSelector: "main",
        integrity: "sha256-xxx",
      },
    ]);

    await expect(
      detectDrift({
        html: `<article>body only, without itemprop</article>`,
        fileName: "empty.cas.json",
        outputDir,
      }),
    ).resolves.toEqual({
      status: "html_no_targets",
      casFilePath: dest,
    });
  });
});

test("detectDrift: returns cas_invalid when the CAS is invalid", async () => {
  await withTempDir(async (dir) => {
    const outputDir = join(dir, "cas");
    await mkdir(outputDir, { recursive: true });

    const notJson = casFilePath({ fileName: "not-json.cas.json", outputDir });
    await writeFile(notJson, "{", "utf8");
    await expect(
      detectDrift({
        html: "<main>x</main>",
        fileName: "not-json.cas.json",
        outputDir,
      }),
    ).resolves.toMatchObject({
      status: "cas_invalid",
      casFilePath: notJson,
    });

    const notArray = casFilePath({ fileName: "object.cas.json", outputDir });
    await writeFile(notArray, JSON.stringify({ attestation: "x" }), "utf8");
    await expect(
      detectDrift({
        html: "<main>x</main>",
        fileName: "object.cas.json",
        outputDir,
      }),
    ).resolves.toEqual({
      status: "cas_invalid",
      casFilePath: notArray,
      reason: "Invalid CAS file format (expected JSON array with JWT string)",
    });

    const badJwt = casFilePath({ fileName: "bad-jwt.cas.json", outputDir });
    await writeFile(badJwt, JSON.stringify(["not-a-jwt"]), "utf8");
    await expect(
      detectDrift({
        html: "<main>x</main>",
        fileName: "bad-jwt.cas.json",
        outputDir,
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
    const outputDir = join(dir, "cas");
    await mkdir(outputDir, { recursive: true });
    const dest = casFilePath({ fileName: "wrapped.cas.json", outputDir });
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

    await expect(
      detectDrift({ html, fileName: "wrapped.cas.json", outputDir }),
    ).resolves.toEqual({
      status: "ok",
      casFilePath: dest,
    });
  });
});

test("detectDrift: evaluates HTML with the textSelector option when CAS has no cssSelector", async () => {
  const html = `<main>Main text</main>`;
  const integrity = await extractTextIntegrity(html, "main");

  await withTempDir(async (dir) => {
    const outputDir = join(dir, "cas");
    const dest = await writeCasTargets(
      outputDir,
      "fallback-selector.cas.json",
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
        fileName: "fallback-selector.cas.json",
        outputDir,
      }),
    ).resolves.toEqual({
      status: "html_no_targets",
      casFilePath: dest,
    });
    await expect(
      detectDrift({
        html,
        fileName: "fallback-selector.cas.json",
        outputDir,
        textSelector: "main",
      }),
    ).resolves.toEqual({
      status: "ok",
      casFilePath: dest,
    });
  });
});

test("detectDrift: rejects an empty outputDir", async () => {
  await Promise.all(
    ["", "   "].map((outputDir) =>
      expect(
        detectDrift({
          html: "<main>x</main>",
          fileName: "a.cas.json",
          outputDir,
        }),
      ).rejects.toMatchObject({
        name: "CaClientError",
        code: CaClientErrorCode.Validation,
        message: "outputDir must be a non-empty string",
      }),
    ),
  );
});

test("detectDrift: rejects an empty fileName", async () => {
  await Promise.all(
    ["", "   "].map((fileName) =>
      expect(
        detectDrift({ html: "<main>x</main>", fileName, outputDir: "cas" }),
      ).rejects.toMatchObject({
        name: "CaClientError",
        code: CaClientErrorCode.Validation,
        message: "fileName must be a non-empty string",
      }),
    ),
  );
});
