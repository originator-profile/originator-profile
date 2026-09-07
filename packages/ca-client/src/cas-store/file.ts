import { ContentAttestationSet } from "@originator-profile/model";
import {
  JwtVcDecoder,
  VcDecodeFailed,
} from "@originator-profile/securing-mechanism";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { CaClientError, CaClientErrorCode } from "../errors";
import { isEnoent, toFileError } from "../file-utils";
import { isRecord } from "../is-record";

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

const jwtVcDecoder = JwtVcDecoder();

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
 * Take the leading JWT from CAS file JSON (`["<JWT>"]` or
 * `[{ main: true, attestation: "<JWT>" }]`).
 */
export const parseCasFileContent = (fileContent: string): string => {
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

  const jwt = jwtFromCasItem(cas.data[0]);
  if (!jwt) {
    throw new CaClientError(INVALID_CAS_FORMAT, {
      code: CaClientErrorCode.Validation,
    });
  }

  return jwt;
};

const decodeCasJwt = (token: string): Record<string, unknown> => {
  const decoded = jwtVcDecoder(token);
  if (decoded instanceof VcDecodeFailed) {
    throw new CaClientError(`Failed to decode CAS JWT: ${decoded.message}`, {
      code: CaClientErrorCode.Validation,
      cause: decoded,
    });
  }
  return decoded.doc;
};

export type ReadCasFileResult = {
  jwt: string;
  payload: Record<string, unknown>;
};

/**
 * Read a CAS file and return its JWT and decoded payload.
 * Read counterpart of `writeCasFile`. Relative paths resolve against cwd.
 */
export const readCasFile = async (
  filePath: string,
): Promise<ReadCasFileResult> => {
  const dest = resolveCasFilePath(filePath);
  let fileContent: string;
  try {
    fileContent = await readFile(dest, "utf8");
  } catch (error) {
    throw toFileError(`Failed to read CAS file ${dest}`, error);
  }

  const jwt = parseCasFileContent(fileContent);
  return { jwt, payload: decodeCasJwt(jwt) };
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
