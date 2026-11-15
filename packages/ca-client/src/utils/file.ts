import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { CaClientError, CaClientErrorCode } from "../errors.ts";

export const isEnoent = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "ENOENT";

export const toFileError = (message: string, error: unknown): CaClientError => {
  if (error instanceof CaClientError) {
    return error;
  }
  return new CaClientError(
    `${message}: ${error instanceof Error ? error.message : String(error)}`,
    { code: CaClientErrorCode.File, cause: error },
  );
};

export const readText = async (file: string): Promise<string> => {
  try {
    return await readFile(file, "utf-8");
  } catch (error) {
    throw toFileError(`Failed to read ${file}`, error);
  }
};

export const writeText = async (file: string, text: string): Promise<void> => {
  try {
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, text);
  } catch (error) {
    throw toFileError(`Failed to write ${file}`, error);
  }
};
