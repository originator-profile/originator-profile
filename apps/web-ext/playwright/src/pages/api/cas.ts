import { sign, writeJson } from "./_utils.js";

export async function POST(): Promise<Response> {
  const content = await sign("_content.json");

  await writeJson("../../../public/examples/cas.json", [content]);

  return new Response("ok");
}
