import { generateKey, LocalKeys } from "@originator-profile/cryptography";
import { WebMediaProfile } from "@originator-profile/model";
import {
  JwtVcVerifier,
  signJwtVc,
  VcValidator,
  VerifiedJwtVc,
} from "@originator-profile/securing-mechanism";
import { addYears } from "date-fns";
import { describe, expect, test } from "vitest";

const issuedAt = new Date();
const expiredAt = addYears(new Date(), 10);
const webMediaProfile = {
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://originator-profile.org/ns/credentials/v1",
    "https://originator-profile.org/ns/cip/v1",
    { "@language": "ja" },
  ],
  type: ["VerifiableCredential", "WebMediaProfile"],
  issuer: "dns:wmp-issuer.example.org",
  credentialSubject: {
    id: "dns:wmp-holder.example.jp",
    type: "OnlineBusiness",
    url: "https://www.wmp-holder.example.jp/",
    name: "○○メディア (※開発用サンプル)",
    logo: {
      id: "https://www.wmp-holder.example.jp/logo.svg",
      digestSRI: "sha256-uU0nuZNNPgilLlLX2n2r+sSE7+N6U4DukIj3rOLvzek=",
    },
    email: "contact@wmp-holder.example.jp",
    telephone: "0000000000",
    contactPoint: {
      id: "https://wmp-holder.example.jp/contact",
      name: "お問い合わせ",
    },
    privacyPolicyPage: {
      id: "https://wmp-holder.example.jp/privacy",
      name: "プライバシーポリシー",
    },
    informationTransmissionPolicy: {
      id: "https://wmp-holder.example.jp/statement",
      name: "新聞倫理綱領",
    },
    publishingPrinciple: {
      id: "https://wmp-holder.example.jp/editorial-guidelines",
      name: "編集ガイドライン",
    },
    description: [
      {
        encodingFormat: "text/plain",
        text: "この文章はこの Web メディアに関する補足情報です。",
      },
    ],
  },
} as const satisfies WebMediaProfile;

describe("WebMediaProfile の検証", () => {
  test("検証に成功", async () => {
    const { publicKey, privateKey } = await generateKey();
    const keys = LocalKeys({ keys: [publicKey] });
    const validator =
      VcValidator<VerifiedJwtVc<WebMediaProfile>>(WebMediaProfile);
    const verifier = JwtVcVerifier(
      keys,
      "dns:wmp-issuer.example.org",
      validator,
    );
    const jwt = await signJwtVc(webMediaProfile, privateKey, {
      issuedAt,
      expiredAt,
    });
    const result = await verifier(jwt);
    expect(result).not.toBeInstanceOf(Error);
    // @ts-expect-error assert
    expect(result.doc).toStrictEqual(webMediaProfile);
  });
});
