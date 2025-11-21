import type { RawTarget } from "@originator-profile/model";
import { JSDOM } from "jsdom";

export async function documentProvider({
  type,
  content = "",
}: RawTarget): Promise<Document> {
  if (type === "ExternalResourceTargetIntegrity") {
    throw new Error(
      "ExternalResourceTargetIntegrity is not supported in this context.",
    );
  }

  if (Array.isArray(content) && content.length > 1) {
    throw new Error("Multiple contents are not supported in this context.");
  }

  [content] = [content].flat();
  let url: string | undefined;
  let html: string = "";

  if (URL.canParse(content)) {
    url = content;
    html = await fetch(url).then((res) => res.text());
  } else {
    url = undefined;
    html = content;
  }

  const dom = new JSDOM(html, {
    url,
  });

  return dom.window.document;
}
