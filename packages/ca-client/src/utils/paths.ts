import { globby } from "globby";
import { existsSync } from "node:fs";
import { isAbsolute, relative } from "node:path";

export const isInside = (dir: string, file: string): boolean => {
  const rel = relative(dir, file);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
};

/** `baseDir` 配下の `ext` ファイルを絶対パスで返す。無いときは空配列。 */
export const listFiles = async (
  baseDir: string,
  ext: string,
): Promise<string[]> =>
  existsSync(baseDir)
    ? (await globby(`**/*${ext}`, { cwd: baseDir, absolute: true })).sort()
    : [];
