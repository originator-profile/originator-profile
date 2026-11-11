import { UnsignedContentAttestation } from "@originator-profile/model";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { CaClient } from "../ca-client/create-ca-client";
import { targetDrift } from "../cas/drift";
import { readCasFile, writeCasFile } from "../cas/file";

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
  const htmls = new Set<string>();
  for (const target of uca.target) {
    const content = Array.isArray(target.content)
      ? target.content
      : [target.content];
    if (
      !DOM_TARGET_TYPES.has(target.type) ||
      content.length !== 1 ||
      typeof content[0] !== "string" ||
      !isFilePath(content[0])
    ) {
      continue;
    }
    const html = await readFile(resolve(root, content[0]), "utf-8");
    target.content = html;
    htmls.add(html);
  }
  return { uca, htmls };
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
    const [entry] = await readCasFile(filePath);
    const { status } =
      html === undefined || entry === undefined
        ? { status: "cas_missing" }
        : await targetDrift({ html, payload: entry.payload });
    if (status !== "ok") {
      throw new Error(
        `Inline verification failed: ${input.out} が入力の HTML と一致しません (${status})`,
      );
    }
  }
  return jwt;
};
