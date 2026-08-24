import { mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { CaClientError, CaClientErrorCode } from "../errors";
import { isEnoent, toFileError } from "../file-utils";

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

const unlinkMissing = async (filePath: string): Promise<void> => {
  try {
    await unlink(filePath);
  } catch (error) {
    if (isEnoent(error)) {
      return;
    }
    throw toFileError(`Failed to delete CAS file ${filePath}`, error);
  }
};

/** Resolve a CAS file path. Relative paths use the current working directory. */
export const resolveCasFilePath = (filePath: string): string => {
  if (isEmpty(filePath)) {
    throw new CaClientError("filePath must be a non-empty string", {
      code: CaClientErrorCode.Validation,
    });
  }
  return resolve(filePath);
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

export const deleteCasFiles = async (filePaths: string[]): Promise<void> => {
  if (filePaths.length === 0) {
    return;
  }

  const dests = filePaths.map((filePath) => resolveCasFilePath(filePath));

  await Promise.all(dests.map((dest) => unlinkMissing(dest)));
};
