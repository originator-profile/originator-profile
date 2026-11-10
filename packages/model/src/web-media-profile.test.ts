import { describe, expect, test } from "vitest";
import { WebMediaProfile } from "./web-media-profile";

const wmp = {
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://originator-profile.org/ns/credentials/v1",
    { "@language": "ja" },
  ],
  type: ["VerifiableCredential", "WebMediaProfile"],
  issuer: "dns:wmp-issuer.example.org",
  credentialSubject: {
    id: "dns:wmp-holder.example.jp",
    type: "OnlineBusiness",
    url: "https://www.wmp-holder.example.jp/",
    name: "○○メディア",
  },
};

describe("WebMediaProfile の @context", () => {
  test("cip/v1 を含まない", () => {
    expect(WebMediaProfile.safeParse(wmp).success).toBe(true);
  });

  test("cip/v1 を含む", () => {
    const result = WebMediaProfile.safeParse({
      ...wmp,
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        "https://originator-profile.org/ns/credentials/v1",
        "https://originator-profile.org/ns/cip/v1",
        { "@language": "ja" },
      ],
    });
    expect(result.success).toBe(true);
  });

  test("credentials/v1 を含まない", () => {
    const result = WebMediaProfile.safeParse({
      ...wmp,
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        { "@language": "ja" },
      ],
    });
    expect(result.success).toBe(false);
  });
});
