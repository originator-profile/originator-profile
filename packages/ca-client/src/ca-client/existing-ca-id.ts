import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { decodeCasVc, parseCasTokenFromFileContent } from "./cas-token";

export const readExistingCaId = async (
  casFileName: string,
  outputPath: string,
): Promise<string | undefined> => {
  const filePath = join(outputPath, casFileName);
  if (!existsSync(filePath)) {
    return undefined;
  }

  const content = await readFile(filePath, "utf-8");
  const token = parseCasTokenFromFileContent(content, filePath);
  const payload = decodeCasVc(token);
  const credentialSubject = payload.credentialSubject as
    | { id?: string }
    | undefined;

  return credentialSubject?.id;
};
