import { generateKey, LocalKeys } from "@originator-profile/cryptography";
import type { UnsignedContentAttestation } from "@originator-profile/model";
import { signCa } from "@originator-profile/sign";
import { test as base } from "@wordpress/e2e-test-utils-playwright";
import { JSDOM } from "jsdom";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import path from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const issuer = "dns:localhost";
const secret = "e2e:local-only";
const cwd = path.resolve(import.meta.dirname, "..");

async function wp(...args: string[]) {
  const { stdout } = await exec(
    "docker",
    [
      "compose",
      "exec",
      "--user",
      "www-data",
      "wordpress",
      "wp",
      "--path=/var/www/html",
      ...args,
    ],
    { cwd },
  );
  return stdout;
}

type LocalCa = {
  keys: ReturnType<typeof LocalKeys>;
  issuer: string;
  submissions: Map<string, UnsignedContentAttestation>;
  errors: string[];
};

async function restoreOptions(
  names: string[],
  previous: { option_name: string; option_value: string }[],
) {
  for (const name of names) {
    const old = previous.find((option) => option.option_name === name);
    // oxlint-disable-next-line no-await-in-loop -- WordPress の設定変更は順番に完了させる.
    await (old
      ? wp("option", "update", name, old.option_value)
      : wp("option", "delete", name));
  }
}

export const test = base.extend<Record<never, never>, { localCa: LocalCa }>({
  localCa: [
    // oxlint-disable-next-line no-empty-pattern -- Playwright は依存のない fixture にも分割代入を要求する.
    async ({}, runFixture) => {
      const { publicKey, privateKey } = await generateKey();
      const submissions = new Map<string, UnsignedContentAttestation>();
      const errors: string[] = [];
      const server = createServer(async (request, response) => {
        try {
          if (
            request.headers.authorization !==
            "Basic " + Buffer.from(secret).toString("base64")
          ) {
            response.writeHead(401).end();
            return;
          }
          if (request.method === "DELETE") {
            response.writeHead(204).end();
            return;
          }
          if (request.method !== "POST" || request.url !== "/ca") {
            response.writeHead(404).end();
            return;
          }
          let body = "";
          for await (const chunk of request) body += chunk;
          const uca: UnsignedContentAttestation = JSON.parse(body);
          const url = Array.isArray(uca.allowedUrl)
            ? uca.allowedUrl[0]
            : uca.allowedUrl;
          if (!url) throw new Error("CA request has no allowedUrl");
          submissions.set(url, structuredClone(uca));
          uca.credentialSubject.id ??= "urn:uuid:" + randomUUID();
          const jwt = await signCa(uca, privateKey, {
            expiredAt: new Date(Date.now() + 86400000),
            documentProvider: async (target) => {
              if (typeof target.content !== "string")
                throw new Error("Expected HTML content in CA request");
              return new JSDOM(target.content).window.document;
            },
          });
          response
            .writeHead(200, { "Content-Type": "application/json" })
            .end(JSON.stringify([jwt]));
        } catch (error) {
          errors.push(String(error));
          response.writeHead(500).end(JSON.stringify({ error: String(error) }));
        }
      });
      const options = {
        profile_ca_server_hostname: "localhost",
        profile_ca_server_admin_secret: secret,
        profile_ca_issuer_id: issuer,
        profile_ca_target_type: "HtmlTargetIntegrity",
        profile_ca_target_css_selector:
          "h1.wp-block-post-title, .wp-block-post-content>*:not(.post-nav-links)",
        profile_ca_target_html:
          '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><h1 class="wp-block-post-title">%TITLE%</h1><div class="wp-block-post-content">%CONTENT%</div></body></html>',
        profile_ca_embedded_or_external: "embedded",
      };
      const previous: { option_name: string; option_value: string }[] =
        JSON.parse(
          await wp("option", "list", "--search=profile_ca_*", "--format=json"),
        );
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        // Docker 内の WordPress から host.docker.internal:8080 で接続する.
        server.listen(8080, "0.0.0.0", resolve);
      });
      try {
        for (const [name, value] of Object.entries(options)) {
          // oxlint-disable-next-line no-await-in-loop -- 復元開始前にすべての設定変更を完了させる.
          await wp("option", "update", name, value);
        }
        await runFixture({
          keys: LocalKeys({ keys: [publicKey] }),
          issuer,
          submissions,
          errors,
        });
      } finally {
        try {
          await restoreOptions(Object.keys(options), previous);
        } finally {
          server.closeAllConnections();
          await new Promise<void>((resolve) => {
            server.close(() => resolve());
          });
        }
      }
    },
    { scope: "worker" },
  ],
});
