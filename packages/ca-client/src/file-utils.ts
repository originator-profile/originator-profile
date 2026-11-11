import { isAbsolute, relative } from "node:path";
import { CaClientError, CaClientErrorCode } from "./errors";

export const isInside = (dir: string, file: string): boolean => {
  const rel = relative(dir, file);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
};

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
