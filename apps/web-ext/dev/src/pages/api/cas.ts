import { globSync } from "node:fs";
import path from "node:path";
import { sign, writeJson } from "./_utils";

export const prerender = false;

export async function POST(): Promise<Response> {
  const matches = globSync(path.join(import.meta.dirname, "_contents/*.json"));
  for (const contentPath of matches) {
    const targetPath = path.join(
      "../../../public/examples",
      path.basename(contentPath),
    );

    const content = await sign(contentPath, "ca");

    await writeJson(targetPath, [content]);
  }

  return new Response("ok");
}
