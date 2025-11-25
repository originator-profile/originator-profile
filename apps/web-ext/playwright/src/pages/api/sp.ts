import child_process from "node:child_process";
import fs from "node:fs/promises";
import util from "node:util";

const exec = util.promisify(child_process.exec);

const targetPath = new URL(
  "../../../public/.well-known/sp.json",
  import.meta.url,
).pathname;

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
  const {
    0: core,
    1: annotation,
    2: media,
    3: site,
  } = await Promise.all([
    sign("_core.json"),
    sign("_annotation.json"),
    sign("_media.json"),
    sign("_site.json"),
  ]);

  await fs.writeFile(
    targetPath,
    `${JSON.stringify(
      {
        originators: [
          {
            core,
            annotations: [annotation],
            media,
          },
        ],
        credential: site,
      },
      null,
      2,
    )}
`,
  );

  return new Response("ok");
}
