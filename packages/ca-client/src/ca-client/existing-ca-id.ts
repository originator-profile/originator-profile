import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isRecord } from "../is-record";
import { decodeCasVc, parseCasTokenFromFileContent } from "./cas-token";

export const readExistingCaId = async (
  casFileName: string,
  outputPath: string,
): Promise<string | undefined> => {
  const filePath = join(outputPath, casFileName);
  const content = await readFile(filePath, "utf-8").catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        return undefined;
      }
      throw error;
    },
  );
  if (content === undefined) {
    return undefined;
  }

  const token = parseCasTokenFromFileContent(content, filePath);
  const payload = decodeCasVc(token);
  const credentialSubject = payload.credentialSubject;
  if (!isRecord(credentialSubject) || typeof credentialSubject.id !== "string") {
    return undefined;
  }

  return credentialSubject.id;
};
