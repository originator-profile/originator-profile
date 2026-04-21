import { globSync } from "node:fs";
import path from "node:path";
import { sign, writeJson } from "./_utils";

export const prerender = false;

export async function POST(): Promise<Response> {
  const matches = globSync(path.join(import.meta.dirname, "_contents/*.json"));

  // cas-mixed-*.json を結合するための配列
  const mixedCas: string[] = [];

  for (const contentPath of matches) {
    const basename = path.basename(contentPath);

    // cas-mixed-*.json は結合用に収集
    if (basename.startsWith("cas-mixed-")) {
      const content = await sign(contentPath, "ca");
      mixedCas.push(content);
      continue;
    }

    const targetPath = path.join("../../../public/examples", basename);
    const content = await sign(contentPath, "ca");
    await writeJson(targetPath, [content]);
  }

  // 結合したcas-mixed.jsonを出力
  if (mixedCas.length > 0) {
    await writeJson("../../../public/examples/cas-mixed.json", mixedCas);
  }

  return new Response("ok");
}
