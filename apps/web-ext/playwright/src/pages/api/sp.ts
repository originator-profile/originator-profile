import { sign, writeJson } from "./_utils.js";

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

  await writeJson("../../../public/.well-known/sp.json", {
    originators: [
      {
        core,
        annotations: [annotation],
        media,
      },
    ],
    credential: site,
  });

  return new Response("ok");
}
