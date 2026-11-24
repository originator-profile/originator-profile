import { UnsignedContentAttestation } from "@originator-profile/model";
import { resolve } from "node:path";
import type { CaClient } from "../ca-server/create-ca-client.ts";
import { writeCasFile } from "../cas/file.ts";
import { CaClientError, CaClientErrorCode } from "../errors.ts";
import { compareTargets } from "../targets/compare.ts";
import { readText } from "../utils/file.ts";

const DOM_TARGET_TYPES = new Set([
  "TextTargetIntegrity",
  "VisibleTextTargetIntegrity",
  "HtmlTargetIntegrity",
]);

const isFilePath = (content: string): boolean =>
  !URL.canParse(content) && !content.trimStart().startsWith("<");

/**
 * 未署名 CA の DOM target の content がファイルパスなら HTML を読み込んで差し替える。
 * `buildUnsignedCa` が書いたパス、または手書き JSON のパスの両方を署名前に通す。
 */
export const resolveTargetContent = async (
  uca: UnsignedContentAttestation,
  root: string,
): Promise<{ uca: UnsignedContentAttestation; htmls: Set<string> }> => {
  const loaded = await Promise.all(
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
        return { target, html: undefined };
      }
      const html = await readText(resolve(root, content[0]));
      return { target: { ...target, content: html }, html };
    }),
  );
  return {
    uca: { ...uca, target: loaded.map(({ target }) => target) },
    htmls: new Set(
      loaded
        .map(({ html }) => html)
        .filter((html): html is string => html !== undefined),
    ),
  };
};

const loadUnsignedCa = async (
  input: string,
  root: string,
): Promise<{ uca: UnsignedContentAttestation; htmls: Set<string> }> => {
  const text = await readText(resolve(input));
  let parsed: UnsignedContentAttestation;
  try {
    parsed = UnsignedContentAttestation.parse(JSON.parse(text));
  } catch (error) {
    throw new CaClientError(`${input} is not a valid unsigned CA`, {
      code: CaClientErrorCode.Validation,
      cause: error,
    });
  }
  return resolveTargetContent(parsed, root);
};

export type SignCaFileOptions = {
  /** 未署名の CA の JSON ファイル。 */
  input: string;
  /** 署名した CA を書く CAS ファイル。省略すると書かない。 */
  out?: string;
  signer: Pick<CaClient, "sign">;
  /** target の content に書いた HTML ファイルのパスの基準。 */
  root: string;
};

export const signCaFile = async (input: SignCaFileOptions): Promise<string> => {
  const { uca, htmls } = await loadUnsignedCa(input.input, input.root);
  const jwt = await input.signer.sign(uca);
  if (input.out === undefined) {
    return jwt;
  }
  await writeCasFile({ filePath: resolve(input.out), jwt });
  // compareTargets は HTML 1 本前提。複数 target が別ファイルを指す場合は検証を省略する
  if (htmls.size === 1) {
    const [html] = htmls;
    const { status } = await compareTargets({ html, jwt });
    if (status !== "ok") {
      throw new CaClientError(
        `Inline verification failed: ${input.out} does not match the input HTML (${status})`,
        { code: CaClientErrorCode.Verification },
      );
    }
  }
  return jwt;
};
