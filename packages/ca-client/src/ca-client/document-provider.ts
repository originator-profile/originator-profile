import type { RawTarget } from "@originator-profile/model";
import { JSDOM } from "jsdom";
import { CaClientError, CaClientErrorCode } from "../errors";

export async function documentProvider({
  type,
  content = "",
}: RawTarget): Promise<Document> {
  if (type === "ExternalResourceTargetIntegrity") {
    throw new CaClientError(
      "Invalid Content Attestation: ExternalResourceTargetIntegrity is not supported",
      { code: CaClientErrorCode.Validation },
    );
  }

  if (Array.isArray(content) && content.length > 1) {
    throw new CaClientError(
      "Invalid Content Attestation: multiple contents are not supported",
      { code: CaClientErrorCode.Validation },
    );
  }

  [content] = [content].flat();
  let url: string | undefined;
  let html: string;

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
