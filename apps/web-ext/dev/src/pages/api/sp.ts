import { sign, writeJson } from "./_utils";

export async function POST(): Promise<Response> {
  const {
    0: core,
    1: annotation,
    2: mediaJa,
    3: mediaEn,
    4: siteJa,
    5: siteEn,
  } = await Promise.all([
    sign("_core.json"),
    sign("_annotation.json"),
    sign("_media.json"),
    sign("_media-en.json"),
    sign("_site.json"),
    sign("_site-en.json"),
  ]);

  await writeJson("../../../public/.well-known/sp.json", {
    originators: [
      {
        core,
        annotations: [annotation],
        media: [mediaJa, mediaEn],
      },
    ],
    sites: [siteJa, siteEn],
  });

  return new Response("ok");
}
