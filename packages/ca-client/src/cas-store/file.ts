import { mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { CaClientError, CaClientErrorCode } from "../errors";

export type WriteCasFileOptions = {
  /** CAS file name, e.g. `ja-JP.page.cas.json`. */
  fileName: string;
  /** Signed JWT string to write. */
  jwt: string;
  /**
   * Output directory. Relative paths resolve against `baseDir`
   * (or the current working directory if omitted).
   */
  outputDir: string;
  /**
   * Base directory for a relative `outputDir`.
   * Defaults to the current working directory.
   */
  baseDir?: string;
};

type CasDirOptions = Pick<WriteCasFileOptions, "outputDir" | "baseDir">;

const isEmpty = (value: string): boolean => value === "";

const isEnoent = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "ENOENT";

const toFileError = (message: string, error: unknown): CaClientError => {
  if (error instanceof CaClientError) {
    return error;
  }
  return new CaClientError(
    `${message}: ${error instanceof Error ? error.message : String(error)}`,
    { code: CaClientErrorCode.File, cause: error },
  );
};

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

/** Resolve a CAS output directory. Relative paths use `baseDir` or the current working directory. */
export const resolveCasDir = ({
  outputDir,
  baseDir,
}: CasDirOptions): string => {
  if (isEmpty(outputDir)) {
    throw new CaClientError("outputDir must be a non-empty string", {
      code: CaClientErrorCode.Validation,
    });
  }
  return resolve(baseDir ?? process.cwd(), outputDir);
};

export const casFilePath = ({
  fileName,
  outputDir,
  baseDir,
}: Pick<WriteCasFileOptions, "fileName" | "outputDir" | "baseDir">): string => {
  if (isEmpty(fileName)) {
    throw new CaClientError("fileName must be a non-empty string", {
      code: CaClientErrorCode.Validation,
    });
  }
  return join(resolveCasDir({ outputDir, baseDir }), fileName);
};

export const writeCasFile = async ({
  fileName,
  jwt,
  outputDir,
  baseDir,
}: WriteCasFileOptions): Promise<void> => {
  if (isEmpty(jwt)) {
    throw new CaClientError("jwt must be a non-empty string", {
      code: CaClientErrorCode.Validation,
    });
  }
  const dest = casFilePath({ fileName, outputDir, baseDir });
  const casContent = `${JSON.stringify([jwt], null, 2)}\n`;

  try {
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, casContent, "utf8");
  } catch (error) {
    throw toFileError(`Failed to write CAS file ${dest}`, error);
  }
};

export const deleteCasFiles = async (
  fileNames: string[],
  { outputDir, baseDir }: CasDirOptions,
): Promise<void> => {
  if (fileNames.length === 0) {
    return;
  }

  const dir = resolveCasDir({ outputDir, baseDir });

  await Promise.all(
    fileNames.map((fileName) => {
      if (isEmpty(fileName)) {
        throw new CaClientError("fileName must be a non-empty string", {
          code: CaClientErrorCode.Validation,
        });
      }
      return unlinkMissing(join(dir, fileName));
    }),
  );
};
