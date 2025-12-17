import { v5 as uuid5, validate } from "uuid";

/**
 * 会員 ID またはドメイン名の解析
 * @param uuidOrDns UUID 文字列表現 (RFC 9562) またはドメイン名 (RFC 4501)
 * @return UUID 文字列表現
 */
export function parseAccountId(uuidOrDns: string): string {
  uuidOrDns = uuidOrDns.toLowerCase();

  if (uuidOrDns.startsWith("urn:uuid:") || validate(uuidOrDns)) {
    const uuid = uuidOrDns.replace(/^urn:uuid:/, "");
    return uuid;
  }

  const dns = uuidOrDns.replace(/^dns:/, "");
  return uuid5(dns, uuid5.DNS);
}
