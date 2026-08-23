import { mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { CaClientError, CaClientErrorCode } from "../errors";
import { isEnoent, toFileError } from "../file-utils";

export type WriteCasFileOptions = {
  /** CAS file name relative to `outputDir`, e.g. `ja-JP.page.cas.json`. */
  fileName: string;
  /** Signed JWT string to write. */
  jwt: string;
  /**
   * Output directory. Relative paths (e.g. `./dist/cas`) resolve against
   * the current working directory. Absolute paths are used as-is.
   */
  outputDir: string;
};

const isEmpty = (value: string): boolean => value.trim() === "";

const isInsideCasDir = (dir: string, dest: string): boolean => {
  const rel = relative(dir, dest);
  return rel !== "" && !isAbsolute(rel) && !rel.split(sep).includes("..");
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

/** Resolve a CAS output directory. Relative paths use the current working directory. */
export const resolveCasDir = (outputDir: string): string => {
  if (isEmpty(outputDir)) {
    throw new CaClientError("outputDir must be a non-empty string", {
      code: CaClientErrorCode.Validation,
    });
  }
  return resolve(outputDir);
};

export const casFilePath = ({
  fileName,
  outputDir,
}: Pick<WriteCasFileOptions, "fileName" | "outputDir">): string => {
  if (isEmpty(fileName)) {
    throw new CaClientError("fileName must be a non-empty string", {
      code: CaClientErrorCode.Validation,
    });
  }
  const dir = resolveCasDir(outputDir);
  const dest = resolve(dir, fileName);
  if (!isInsideCasDir(dir, dest)) {
    throw new CaClientError("fileName must stay inside outputDir", {
      code: CaClientErrorCode.Validation,
    });
  }
  return dest;
};

export const writeCasFile = async ({
  fileName,
  jwt,
  outputDir,
}: WriteCasFileOptions): Promise<void> => {
  if (isEmpty(jwt)) {
    throw new CaClientError("jwt must be a non-empty string", {
      code: CaClientErrorCode.Validation,
    });
  }
  const dest = casFilePath({ fileName, outputDir });
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
  outputDir: string,
): Promise<void> => {
  const dir = resolveCasDir(outputDir);
  if (fileNames.length === 0) {
    return;
  }

  const dests = fileNames.map((fileName) =>
    casFilePath({ fileName, outputDir: dir }),
  );

  await Promise.all(dests.map((filePath) => unlinkMissing(filePath)));
};
