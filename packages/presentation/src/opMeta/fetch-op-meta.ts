import { OpMeta } from "@originator-profile/model";
import { getEmbeddedData } from "../get-embedded-data";
import { FetchOpMetaResult } from "./types";

function isValidOpMeta(value: unknown): value is OpMeta {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const opMeta = value as { targetopid?: unknown };
  return typeof opMeta.targetopid === "string" && opMeta.targetopid.length > 0;
}

/**
 * OpMeta の取得
 * @param doc Document オブジェクト
 */
export const fetchOpMeta = (doc: Document): FetchOpMetaResult => {
  const opMetas = getEmbeddedData<OpMeta[]>(doc, "application/opmeta+json");

  if (opMetas.length > 1) {
    console.warn(
      "Multiple OpMeta elements found. Only the first one will be used.",
    );
  }

  const firstOpMeta = opMetas[0];
  if (!isValidOpMeta(firstOpMeta)) {
    return undefined;
  }
  return firstOpMeta;
};
