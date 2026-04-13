import { generateKey } from "@originator-profile/cryptography";
import type { Jwk } from "@originator-profile/model";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HookHandler, Plugin, ResolvedConfig } from "vite";
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

function callTransform(plugin: Plugin, html: string) {
  const hook = plugin.transformIndexHtml as PluginHook<"transformIndexHtml">;
  return hook.call({} as never, html, {} as never) as Promise<string>;
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
  test("CAS script 内の unsigned CA が署名され JWT に置換される", async () => {
    const plugin = await createPlugin();
    const html = casHtml(JSON.stringify([sampleUca]));

    const result = await callTransform(plugin, html);

    const cas = extractCas(result);
    expect(cas).toHaveLength(1);
    expect(typeof cas[0]).toBe("string");
    expect((cas[0] as string).startsWith("eyJ")).toBe(true);
  });

  test("CAS script が無い HTML はそのまま返される", async () => {
    const plugin = await createPlugin();
    const html = "<html><body><p>no CAS</p></body></html>";

    const result = await callTransform(plugin, html);

    expect(result).toBe(html);
  });
});

describe("generateBundle", () => {
  test(".well-known/sp.json として emitFile される", async () => {
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
    await bundle.call(
      { emitFile } as never,
      {} as never,
      {} as never,
      false,
    );

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
});

describe("OriginatorProfileOptions validation", () => {
  test("issuers が空はプラグイン初期化時にエラー", () => {
    expect(() => originatorProfile({ issuers: {} })).toThrow(
      "At least one issuer is required",
    );
  });

  test("不正な expiresIn はプラグイン初期化時にエラー", () => {
    expect(() =>
      originatorProfile({
        issuers: { "dns:example.com": "{}" },
        expiresIn: "invalid",
      }),
    ).toThrow("invalid_format");
  });
});
