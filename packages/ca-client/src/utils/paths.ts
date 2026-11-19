import { existsSync, statSync } from "node:fs";
import { glob } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { CaClientError, CaClientErrorCode } from "../errors.ts";

export const isInside = (dir: string, file: string): boolean => {
  const rel = relative(dir, file);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
};

/** True when `path` contains glob metacharacters (not a literal path). */
const isDynamicPattern = (path: string): boolean => /[*?[\]{}]/.test(path);

const globAbsolute = async (pattern: string, cwd: string): Promise<string[]> =>
  Array.fromAsync(glob(pattern, { cwd }), (file) => resolve(cwd, file));

const existingUnder = (baseDir: string, path: string) =>
  [resolve(path), resolve(baseDir, path)].find(
    (candidate) =>
      existsSync(candidate) &&
      (candidate === baseDir || isInside(baseDir, candidate)),
  );

export const coversAll = (baseDir: string, paths: string[]): boolean =>
  paths.length === 0 ||
  paths.some(
    (path) =>
      !isDynamicPattern(path) && existingUnder(baseDir, path) === baseDir,
  );

export const matchFiles = async (
  baseDir: string,
  path: string,
  ext: string,
): Promise<string[]> => {
  if (isDynamicPattern(path)) {
    const prefix = `${relative(process.cwd(), baseDir)}/`;
    const pattern = path.replace(/^\.\//, "");
    const matched = await globAbsolute(
      pattern.startsWith(prefix) ? pattern.slice(prefix.length) : pattern,
      baseDir,
    );
    return matched.filter(
      (file) => file.endsWith(ext) && isInside(baseDir, file),
    );
  }
  const file = existingUnder(baseDir, path);
  if (file === undefined) {
    return [];
  }
  return statSync(file).isDirectory()
    ? globAbsolute(`**/*${ext}`, file)
    : file.endsWith(ext)
      ? [file]
      : [];
};

export const notFound = (path: string, baseDirs: string[]): CaClientError => {
  const where = baseDirs
    .map((dir) => relative(process.cwd(), dir))
    .join(" or ");
  const message =
    !isDynamicPattern(path) &&
    existsSync(resolve(path)) &&
    !baseDirs.some((dir) => existingUnder(dir, path))
      ? `${path} is outside ${where}`
      : `No files in ${where} match ${path}`;
  return new CaClientError(message, { code: CaClientErrorCode.Validation });
};

export const resolveFiles = async (
  baseDir: string,
  paths: string[],
  ext: string,
): Promise<string[]> => {
  if (coversAll(baseDir, paths)) {
    return existsSync(baseDir)
      ? (await globAbsolute(`**/*${ext}`, baseDir)).sort()
      : [];
  }
  const matched = await Promise.all(
    paths.map((path) => matchFiles(baseDir, path, ext)),
  );
  const missing = paths.find((_, index) => matched[index].length === 0);
  if (missing !== undefined) {
    throw notFound(missing, [baseDir]);
  }
  return [...new Set(matched.flat())].sort();
};
