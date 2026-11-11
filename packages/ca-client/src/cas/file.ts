import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { CaClientError, CaClientErrorCode } from "../errors";
import { toFileError } from "../file-utils";
import { decodeEntries, parseCas, type CaEntry } from "./cas";

export type { CaEntry };

export type WriteCasFileOptions = {
  /**
   * Destination CAS file path, e.g. `dist/cas/ja-JP.page.cas.json`.
   * Relative paths resolve against the current working directory.
   */
  filePath: string;
  /** Signed JWT string to write. */
  jwt: string;
};

const isEmpty = (value: string): boolean => value.trim() === "";

/** Resolve a CAS file path. Relative paths use the current working directory. */
export const resolveCasFilePath = (filePath: string): string => {
  if (isEmpty(filePath)) {
    throw new CaClientError("filePath must be a non-empty string", {
      code: CaClientErrorCode.Validation,
    });
  }
  return resolve(filePath);
};

/**
 * Read a CAS file and return every CA.
 * Read counterpart of `writeCasFile`. Relative paths resolve against cwd.
 */
export const readCasFile = async (filePath: string): Promise<CaEntry[]> => {
  const dest = resolveCasFilePath(filePath);
  let fileContent: string;
  try {
    fileContent = await readFile(dest, "utf8");
  } catch (error) {
    throw toFileError(`Failed to read CAS file ${dest}`, error);
  }

  return decodeEntries(parseCas(fileContent));
};

export const writeCasFile = async ({
  filePath,
  jwt,
}: WriteCasFileOptions): Promise<void> => {
  if (isEmpty(jwt)) {
    throw new CaClientError("jwt must be a non-empty string", {
      code: CaClientErrorCode.Validation,
    });
  }
  const dest = resolveCasFilePath(filePath);
  const casContent = `${JSON.stringify([jwt], null, 2)}\n`;

  try {
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, casContent, "utf8");
  } catch (error) {
    throw toFileError(`Failed to write CAS file ${dest}`, error);
  }
};
