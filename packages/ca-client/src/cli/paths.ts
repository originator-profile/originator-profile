import { globby, isDynamicPattern } from "globby";
import { existsSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

export const isInside = (dir: string, file: string): boolean => {
  const rel = relative(dir, file);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
};

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
    const matched = await globby(
      pattern.startsWith(prefix) ? pattern.slice(prefix.length) : pattern,
      { cwd: baseDir, absolute: true },
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
    ? globby(`**/*${ext}`, { cwd: file, absolute: true })
    : file.endsWith(ext)
      ? [file]
      : [];
};

export const notFound = (path: string, baseDirs: string[]): Error => {
  const where = baseDirs
    .map((dir) => relative(process.cwd(), dir))
    .join(" か ");
  return !isDynamicPattern(path) &&
    existsSync(resolve(path)) &&
    !baseDirs.some((dir) => existingUnder(dir, path))
    ? new Error(`${path} は ${where} の外です`)
    : new Error(`${path} に一致するファイルが ${where} にありません`);
};

export const resolveFiles = async (
  baseDir: string,
  paths: string[],
  ext: string,
): Promise<string[]> => {
  if (coversAll(baseDir, paths)) {
    return existsSync(baseDir)
      ? (await globby(`**/*${ext}`, { cwd: baseDir, absolute: true })).sort()
      : [];
  }
  const files = new Set<string>();
  for (const path of paths) {
    const matched = await matchFiles(baseDir, path, ext);
    if (matched.length === 0) {
      throw notFound(path, [baseDir]);
    }
    for (const file of matched) {
      files.add(file);
    }
  }
  return [...files].sort();
};
