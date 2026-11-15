import { ContentAttestationSet } from "@originator-profile/model";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { decodeCa, type DecodedCa } from "../ca/decode.ts";
import { CaClientError, CaClientErrorCode } from "../errors.ts";
import { isEnoent, toFileError } from "../utils/file.ts";
import { isRecord } from "../utils/is-record.ts";

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

const INVALID_CAS_FORMAT =
  "Invalid CAS file format (expected JSON array with JWT string)";

const jwtFromCasItem = (item: unknown): string | undefined => {
  if (typeof item === "string") {
    return item;
  }
  if (!isRecord(item) || typeof item.attestation !== "string") {
    return undefined;
  }
  return item.attestation;
};

/**
 * Take every JWT from CAS file JSON (`["<JWT>"]` or
 * `[{ main: true, attestation: "<JWT>" }]`), in file order.
 */
export const parseCasFileContent = (fileContent: string): string[] => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fileContent);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new CaClientError(detail, {
      code: CaClientErrorCode.Validation,
      cause: error,
    });
  }

  const cas = ContentAttestationSet.safeParse(parsed);
  if (!cas.success) {
    throw new CaClientError(INVALID_CAS_FORMAT, {
      code: CaClientErrorCode.Validation,
    });
  }

  if (cas.data.length === 0) {
    throw new CaClientError(
      "CAS file is empty (expected at least one JWT; inject placeholders use [] until signed)",
      { code: CaClientErrorCode.Validation },
    );
  }

  const jwts = cas.data
    .map(jwtFromCasItem)
    .filter((jwt): jwt is string => Boolean(jwt));
  if (jwts.length === 0 || jwts.length !== cas.data.length) {
    throw new CaClientError(INVALID_CAS_FORMAT, {
      code: CaClientErrorCode.Validation,
    });
  }

  return jwts;
};

/**
 * Read a CAS file and decode every CA in it, in file order.
 * Read counterpart of `writeCasFile`. Relative paths resolve against cwd.
 */
export const readCasFile = async (filePath: string): Promise<DecodedCa[]> => {
  const dest = resolveCasFilePath(filePath);
  let fileContent: string;
  try {
    fileContent = await readFile(dest, "utf8");
  } catch (error) {
    throw toFileError(`Failed to read CAS file ${dest}`, error);
  }

  return parseCasFileContent(fileContent).map(decodeCa);
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
