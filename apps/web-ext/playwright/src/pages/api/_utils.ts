import child_process from "node:child_process";
import fs from "node:fs/promises";
import util from "node:util";

const exec = util.promisify(child_process.exec);

const keyPath = new URL(
  "../../../../e2e/account-key.example.priv.json",
  import.meta.url,
).pathname;

/**
 * Sign a JSON file using @originator-profile/opvc
 */
export async function sign(input: string): Promise<string> {
  const inputPath = new URL(input, import.meta.url).pathname;

  const result = await exec(
    `npx @originator-profile/opvc sign --identity="${keyPath}" --input="${inputPath}"`,
  );

  return result.stdout.trim();
}

/**
 * Write a JSON object to a file with formatting
 */
export async function writeJson(path: string, json: unknown): Promise<void> {
  const targetPath = new URL(path, import.meta.url).pathname;

  await fs.writeFile(targetPath, `${JSON.stringify(json, null, 2)}\n`);
}
