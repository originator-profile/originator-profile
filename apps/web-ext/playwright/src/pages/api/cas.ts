import child_process from "node:child_process";
import fs from "node:fs/promises";
import util from "node:util";

const exec = util.promisify(child_process.exec);

const targetPath = new URL("../../../public/examples/cas.json", import.meta.url)
  .pathname;

const keyPath = new URL(
  "../../../../e2e/account-key.example.priv.json",
  import.meta.url,
).pathname;

async function sign(input: string): Promise<string> {
  const inputPath = new URL(input, import.meta.url).pathname;

  const result = await exec(
    `npx @originator-profile/opvc sign --identity="${keyPath}" --input="${inputPath}"`,
  );

  return result.stdout.trim();
}

export async function POST(): Promise<Response> {
  const content = await sign("_content.json");

  await fs.writeFile(
    targetPath,
    `${JSON.stringify([content], null, 2)}
`,
  );

  return new Response("ok");
}
