import { generateKey } from "@originator-profile/cryptography";
import type { Jwk } from "@originator-profile/model";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decodeJwt } from "jose";
import type {
  HookHandler,
  IndexHtmlTransformContext,
  Plugin,
  ResolvedConfig,
} from "vite";
import { beforeAll, describe, expect, test, vi } from "vitest";
import { originatorProfile } from "./index";

type PluginHook<K extends keyof Plugin> = HookHandler<NonNullable<Plugin[K]>>;

let privateKey: Jwk;

beforeAll(async () => {
  const keys = await generateKey();
  privateKey = keys.privateKey;
});

async function createPlugin(
  overrides: { root?: string; issuers?: Record<string, Jwk> } = {},
) {
  const root = overrides.root ?? "/tmp";
  const issuers = overrides.issuers ?? { "dns:example.com": privateKey };

  const plugin = originatorProfile({ issuers });

  const configResolved = plugin.configResolved as PluginHook<"configResolved">;
  await configResolved.call({} as never, { root } as ResolvedConfig);

  return plugin;
}

function casHtml(json: string): string {
  return `<!DOCTYPE html>
<html><head><title>test</title></head>
<body>
<script type="application/cas+json">${json}</script>
</body></html>`;
}

const CAS_RE =
  /<script type="application\/cas\+json">([\s\S]*?)<\/script>/;

function extractCas(html: string): unknown[] {
  const match = html.match(CAS_RE);
  if (!match) throw new Error("CAS script tag not found in output HTML");
  return JSON.parse(match[1]) as unknown[];
}

function callTransform(
  plugin: Plugin,
  html: string,
  filename = "/tmp/test.html",
) {
  const hook = plugin.transformIndexHtml as PluginHook<"transformIndexHtml">;
  return hook.call(
    {} as never,
    html,
    { filename } as IndexHtmlTransformContext,
  ) as Promise<string>;
}

const sampleUca = {
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://originator-profile.org/ns/credentials/v1",
    "https://originator-profile.org/ns/cip/v1",
    { "@language": "en" },
  ],
  type: ["VerifiableCredential", "ContentAttestation"],
  issuer: "dns:example.com",
  credentialSubject: {
    id: "urn:uuid:78550fa7-f846-4e0f-ad5c-8d34461cb95b",
    type: "Article",
    headline: "Test Article",
    description: "test description",
  },
  target: [
    {
      type: "TextTargetIntegrity",
      cssSelector: "#main",
      content: 'data:text/html,<div id="main">Hello, world!</div>',
    },
  ],
};

const sampleUwsp = {
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://originator-profile.org/ns/credentials/v1",
    "https://originator-profile.org/ns/cip/v1",
    { "@language": "en" },
  ],
  type: ["VerifiableCredential", "WebsiteProfile"],
  issuer: "dns:example.com",
  credentialSubject: {
    id: "https://example.com",
    type: "WebSite",
    name: "Example",
    image: {
      id: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==",
    },
    allowedOrigin: ["https://example.com"],
  },
};

describe("transformIndexHtml", () => {
  test("unsigned CA が署名され CAS 形式で出力される", async () => {
    const plugin = await createPlugin();
    const html = casHtml(JSON.stringify([sampleUca]));

    const result = await callTransform(plugin, html);

    const cas = extractCas(result);
    expect(cas).toHaveLength(1);
    expect(typeof cas[0]).toBe("string");
    expect((cas[0] as string).startsWith("eyJ")).toBe(true);
  });

  test("署名された JWT に target integrity が含まれる", async () => {
    const plugin = await createPlugin();
    const html = casHtml(JSON.stringify([sampleUca]));

    const result = await callTransform(plugin, html);

    const cas = extractCas(result) as string[];

    const payload = decodeJwt(cas[0]);
    const target = (payload.target as Array<{ integrity?: string }>)[0];
    expect(target.integrity).toBeDefined();
    expect(target.integrity).toMatch(/^sha256-/);
  });

  test("image の digestSRI が計算される", async () => {
    const ucaWithImage = {
      ...sampleUca,
      credentialSubject: {
        ...sampleUca.credentialSubject,
        image: {
          id: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==",
        },
      },
    };

    const plugin = await createPlugin();
    const html = casHtml(JSON.stringify([ucaWithImage]));

    const result = await callTransform(plugin, html);

    const cas = extractCas(result) as string[];

    const payload = decodeJwt(cas[0]);
    const image = (payload.credentialSubject as { image?: { digestSRI?: string } })
      .image;
    expect(image?.digestSRI).toBeDefined();
    expect(image?.digestSRI).toMatch(/^sha256-/);
  });

  test("main: true のエントリは { attestation, main } で出力される", async () => {
    const ucaWithMain = { ...sampleUca, main: true };
    const plugin = await createPlugin();
    const html = casHtml(JSON.stringify([ucaWithMain]));

    const result = await callTransform(plugin, html);

    const cas = extractCas(result);

    expect(cas).toHaveLength(1);
    const entry = cas[0] as { attestation: string; main: boolean };
    expect(entry.main).toBe(true);
    expect(typeof entry.attestation).toBe("string");
    expect(entry.attestation.startsWith("eyJ")).toBe(true);
  });

  test("CAS script が無い HTML はそのまま返される", async () => {
    const plugin = await createPlugin();
    const html = "<html><body><p>no CAS</p></body></html>";

    const result = await callTransform(plugin, html);

    expect(result).toBe(html);
  });

  test("issuer に対応する鍵がない場合エラー", async () => {
    const plugin = await createPlugin({ issuers: {} });
    const html = casHtml(JSON.stringify([sampleUca]));

    await expect(callTransform(plugin, html)).rejects.toThrow(
      'No signing key found for issuer "dns:example.com"',
    );
  });
});

describe("generateBundle", () => {
  test("unsigned WSP が署名されて .well-known/sp.json に出力される", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "vite-plugin-test-"));
    writeFileSync(
      join(tempDir, "sp.json"),
      JSON.stringify({
        originators: [{ core: "eyJ..." }],
        sites: [sampleUwsp],
      }),
    );

    const plugin = await createPlugin({ root: tempDir });
    const emitFile = vi.fn();
    const bundle = plugin.generateBundle as PluginHook<"generateBundle">;
    const callBundle = () =>
      bundle.call({ emitFile } as never, {} as never, {} as never, false);

    await callBundle();

    expect(emitFile).toHaveBeenCalledOnce();
    const call = emitFile.mock.calls[0][0] as {
      type: string;
      fileName: string;
      source: string;
    };
    expect(call.type).toBe("asset");
    expect(call.fileName).toBe(".well-known/sp.json");

    const output = JSON.parse(call.source) as {
      originators: unknown[];
      sites: string[];
    };
    expect(output.originators).toEqual([{ core: "eyJ..." }]);
    expect(output.sites).toHaveLength(1);
    expect(output.sites[0].startsWith("eyJ")).toBe(true);
  });

  test("WSP の image に digestSRI が計算される", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "vite-plugin-test-"));
    writeFileSync(
      join(tempDir, "sp.json"),
      JSON.stringify({
        originators: [],
        sites: [sampleUwsp],
      }),
    );

    const plugin = await createPlugin({ root: tempDir });
    const emitFile = vi.fn();
    const bundle = plugin.generateBundle as PluginHook<"generateBundle">;
    const callBundle = () =>
      bundle.call({ emitFile } as never, {} as never, {} as never, false);

    await callBundle();

    const output = JSON.parse(
      (emitFile.mock.calls[0][0] as { source: string }).source,
    ) as { sites: string[] };

    const payload = decodeJwt(output.sites[0]);
    const image = (payload.credentialSubject as { image?: { digestSRI?: string } })
      .image;
    expect(image?.digestSRI).toBeDefined();
    expect(image?.digestSRI).toMatch(/^sha256-/);
  });

  test("originators はパススルーされる", async () => {
    const originators = [
      { core: "eyJfirst", annotations: ["eyJann"], media: ["eyJmedia"] },
      { core: "eyJsecond" },
    ];
    const tempDir = mkdtempSync(join(tmpdir(), "vite-plugin-test-"));
    writeFileSync(
      join(tempDir, "sp.json"),
      JSON.stringify({ originators, sites: [sampleUwsp] }),
    );

    const plugin = await createPlugin({ root: tempDir });
    const emitFile = vi.fn();
    const bundle = plugin.generateBundle as PluginHook<"generateBundle">;
    const callBundle = () =>
      bundle.call({ emitFile } as never, {} as never, {} as never, false);

    await callBundle();

    const output = JSON.parse(
      (emitFile.mock.calls[0][0] as { source: string }).source,
    ) as { originators: unknown[] };
    expect(output.originators).toEqual(originators);
  });
});

const SVG_CONTENT = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';

describe("resolveImageContent", () => {
  test("CA の image.content がローカルパスの場合 Data URL に変換される", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "vite-plugin-test-"));
    mkdirSync(join(tempDir, "images"), { recursive: true });
    writeFileSync(join(tempDir, "images", "logo.svg"), SVG_CONTENT);

    const uca = {
      ...sampleUca,
      credentialSubject: {
        ...sampleUca.credentialSubject,
        image: {
          id: "https://example.com/logo.svg",
          content: "./images/logo.svg",
        },
      },
    };

    const plugin = await createPlugin({ root: tempDir });
    const html = casHtml(JSON.stringify([uca]));
    const result = await callTransform(
      plugin,
      html,
      join(tempDir, "index.html"),
    );

    const cas = extractCas(result) as string[];
    const payload = decodeJwt(cas[0]);
    const image = (
      payload.credentialSubject as { image?: { digestSRI?: string } }
    ).image;
    expect(image?.digestSRI).toBeDefined();
    expect(image?.digestSRI).toMatch(/^sha256-/);
  });

  test("WSP の image.content がローカルパスの場合 Data URL に変換される", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "vite-plugin-test-"));
    mkdirSync(join(tempDir, "images"), { recursive: true });
    writeFileSync(join(tempDir, "images", "logo.svg"), SVG_CONTENT);

    const uwsp = {
      ...sampleUwsp,
      credentialSubject: {
        ...sampleUwsp.credentialSubject,
        image: {
          id: "https://example.com/logo.svg",
          content: "./images/logo.svg",
        },
      },
    };

    writeFileSync(
      join(tempDir, "sp.json"),
      JSON.stringify({ originators: [], sites: [uwsp] }),
    );

    const plugin = await createPlugin({ root: tempDir });
    const emitFile = vi.fn();
    const bundle = plugin.generateBundle as PluginHook<"generateBundle">;
    await bundle.call(
      { emitFile } as never,
      {} as never,
      {} as never,
      false,
    );

    const output = JSON.parse(
      (emitFile.mock.calls[0][0] as { source: string }).source,
    ) as { sites: string[] };
    const payload = decodeJwt(output.sites[0]);
    const image = (
      payload.credentialSubject as { image?: { digestSRI?: string } }
    ).image;
    expect(image?.digestSRI).toBeDefined();
    expect(image?.digestSRI).toMatch(/^sha256-/);
  });

  test("data URL の content はそのまま維持される", async () => {
    const dataUrl =
      "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==";
    const uca = {
      ...sampleUca,
      credentialSubject: {
        ...sampleUca.credentialSubject,
        image: { id: "https://example.com/logo.svg", content: dataUrl },
      },
    };

    const plugin = await createPlugin();
    const html = casHtml(JSON.stringify([uca]));
    const result = await callTransform(plugin, html);

    const cas = extractCas(result) as string[];
    const payload = decodeJwt(cas[0]);
    const image = (
      payload.credentialSubject as { image?: { digestSRI?: string } }
    ).image;
    expect(image?.digestSRI).toBeDefined();
  });
});

describe("parseExpiresIn", () => {
  test("不正な expiresIn はエラー", () => {
    expect(() =>
      originatorProfile({ issuers: {}, expiresIn: "invalid" }),
    ).not.toThrow();

    const plugin = originatorProfile({ issuers: {}, expiresIn: "invalid" });

    const configResolved = plugin.configResolved as PluginHook<"configResolved">;
    expect(() =>
      configResolved.call({} as never, { root: "/tmp" } as ResolvedConfig),
    ).toThrow("Invalid expiresIn format");
  });
});
