import child_process from "node:child_process";
import fs from "node:fs/promises";
import util from "node:util";

const execFile = util.promisify(child_process.execFile);

const keyPath = new URL(
  "../../../../e2e/account-key.example.priv.json",
  import.meta.url,
).pathname;

/**
 * Sign a JSON file using @originator-profile/opvc
 * @param input Path to the JSON file to sign
 * @param mode Mode to use (default: "none"; "ca" applies the predefined ContentAttestation preprocessing steps).
 * @returns The signed VC as a string
 */
export async function sign(
  input: string,
  mode: "none" | "ca" = "none",
): Promise<string> {
  const inputPath = new URL(input, import.meta.url).pathname;

  const result = await execFile("npx", [
    "@originator-profile/opvc",
    mode === "ca" ? "ca:sign" : "sign",
    "--identity",
    keyPath,
    "--input",
    inputPath,
    "--expired-at",
    new Date(
      Date.now() +
        10 * // year
          365.25 *
          24 *
          60 *
          60 *
          1000,
    ).toISOString(),
  ]);

  return result.stdout.trim();
}

/**
 * Write a JSON object to a file with formatting
 */
export async function writeJson(path: string, json: unknown): Promise<void> {
  const targetPath = new URL(path, import.meta.url).pathname;

  await fs.writeFile(targetPath, `${JSON.stringify(json, null, 2)}\n`);
}
