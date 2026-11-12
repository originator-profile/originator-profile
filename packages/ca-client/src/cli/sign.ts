import { UnsignedContentAttestation } from "@originator-profile/model";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { CaClient } from "../ca-client/create-ca-client.ts";
import { writeCasFile } from "../cas-store/file.ts";
import { detectDrift } from "../drift/compare.ts";

const DOM_TARGET_TYPES = new Set([
  "TextTargetIntegrity",
  "VisibleTextTargetIntegrity",
  "HtmlTargetIntegrity",
]);

const isFilePath = (content: string): boolean =>
  !URL.canParse(content) && !content.trimStart().startsWith("<");

const loadUnsignedCa = async (
  input: string,
  root: string,
): Promise<{ uca: UnsignedContentAttestation; htmls: Set<string> }> => {
  const uca = UnsignedContentAttestation.parse(
    JSON.parse(await readFile(resolve(input), "utf-8")),
  );
  const htmls = await Promise.all(
    uca.target.map(async (target) => {
      const content = Array.isArray(target.content)
        ? target.content
        : [target.content];
      if (
        !DOM_TARGET_TYPES.has(target.type) ||
        content.length !== 1 ||
        typeof content[0] !== "string" ||
        !isFilePath(content[0])
      ) {
        return undefined;
      }
      const html = await readFile(resolve(root, content[0]), "utf-8");
      target.content = html;
      return html;
    }),
  );
  return {
    uca,
    htmls: new Set(htmls.filter((html) => html !== undefined)),
  };
};

export const signCaFile = async (input: {
  input: string;
  out: string | undefined;
  signer: Pick<CaClient, "sign">;
  root: string;
}): Promise<string> => {
  const { uca, htmls } = await loadUnsignedCa(input.input, input.root);
  const jwt = await input.signer.sign(uca);
  if (input.out === undefined) {
    return jwt;
  }
  const filePath = resolve(input.out);
  await writeCasFile({ filePath, jwt });
  if (htmls.size === 1) {
    const [html] = htmls;
    const { status } = await detectDrift({ html, filePath });
    if (status !== "ok") {
      throw new Error(
        `Inline verification failed: ${input.out} が入力の HTML と一致しません (${status})`,
      );
    }
  }
  return jwt;
};
