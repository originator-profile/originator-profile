import { globSync } from "node:fs";
import path from "node:path";
import { sign, writeJson } from "./_utils";

export const prerender = false;

export async function POST(): Promise<Response> {
  const {
    0: core,
    1: mediaJa,
    2: mediaEn,
    3: siteJa,
    4: siteEn,
  } = await Promise.all([
    sign("_core.json"),
    sign("_media.json"),
    sign("_media-en.json"),
    sign("_site.json"),
    sign("_site-en.json"),
  ]);
  const annotations = await Promise.all(
    globSync(path.join(import.meta.dirname, "_annotations/*.json")).map((p) =>
      sign(p),
    ),
  );

  await writeJson("../../../public/.well-known/sp.json", {
    originators: [
      {
        core,
        annotations,
        media: [mediaJa, mediaEn],
      },
    ],
    sites: [siteJa, siteEn],
  });

  return new Response("ok");
}
