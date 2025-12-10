import { Command, Flags } from "@oclif/core";
import type {
  CoreProfile,
  WebMediaProfile,
  WebsiteProfile,
} from "@originator-profile/model";
import { signJwtVc } from "@originator-profile/securing-mechanism";
import { fetchAndSetDigestSri } from "@originator-profile/sign";
import { addYears } from "date-fns";
import fs from "node:fs/promises";
import { expirationDate, opId, privateKey } from "../flags.ts";

type MinVC = CoreProfile | WebMediaProfile | WebsiteProfile;

function isValidVc(vc: unknown): vc is MinVC {
  /* 完全な整合性まではチェックしないが、credentialSubject はあるはず */
  return (
    typeof vc === "object" &&
    vc !== null &&
    "credentialSubject" in vc &&
    typeof vc.credentialSubject === "object" &&
    vc.credentialSubject !== null
  );
}

async function addDigestSri(vc: unknown) {
  if (!isValidVc(vc)) throw new Error("Invalid VC");

  const credentialSubject: Record<string, unknown> = vc.credentialSubject;

  await fetchAndSetDigestSri("sha256", credentialSubject.logo);
  await fetchAndSetDigestSri("sha256", credentialSubject.image);

  return Object.assign(vc, { credentialSubject });
}

const exampleCoreProfile = {
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://originator-profile.org/ns/credentials/v1",
  ],
  type: ["VerifiableCredential", "CoreProfile"],
  issuer: "dns:example.org",
  credentialSubject: {
    id: "dns:example.jp",
    type: "Core",
    jwks: {
      keys: [
        {
          kid: "LIstkoCvByn4jk8oZPvigQkzTzO9UwnGnE-VMlkZvYQ",
          kty: "EC",
          crv: "P-256",
          x: "QiVI-I-3gv-17KN0RFLHKh5Vj71vc75eSOkyMsxFxbE",
          y: "bEzRDEy41bihcTnpSILImSVymTQl9BQZq36QpCpJQnI",
        },
      ],
    },
  },
} satisfies CoreProfile;

const exampleWebMediaProfile = {
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://originator-profile.org/ns/credentials/v1",
    "https://originator-profile.org/ns/cip/v1",
    {
      "@language": "ja",
    },
  ],
  type: ["VerifiableCredential", "WebMediaProfile"],
  issuer: "dns:wmp-issuer.example.org",
  credentialSubject: {
    id: "dns:wmp-holder.example.jp",
    type: "OnlineBusiness",
    url: "https://www.wmp-holder.example.jp/",
    name: "○○メディア (※開発用サンプル)",
    logo: {
      id: "https://www.wmp-holder.example.jp/image.png",
      digestSRI: "sha256-Upwn7gYMuRmJlD1ZivHk876vXHzokXrwXj50VgfnMnY=",
    },
    email: "contact@wmp-holder.example.jp",
    telephone: "0000000000",
    contactPoint: {
      id: "https://wmp-holder.example.jp/contact",
      name: "お問い合わせ",
    },
    informationTransmissionPolicy: {
      id: "https://wmp-holder.example.jp/statement",
      name: "情報発信ポリシー",
    },
    publishingPrinciple: {
      id: "https://wmp-holder.example.jp/editorial-guidelines",
      name: "編集ガイドライン",
    },
    privacyPolicy: {
      id: "https://wmp-holder.example.jp/privacy",
      name: "プライバシーポリシー",
    },
    description: [
      {
        encodingFormat: "text/plain",
        text: "この文章はこの Web メディアに関する補足情報です。",
      },
    ],
  },
} satisfies WebMediaProfile;

const exampleWebsiteProfile = {
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://originator-profile.org/ns/credentials/v1",
    "https://originator-profile.org/ns/cip/v1",
    {
      "@language": "ja",
    },
  ],
  type: ["VerifiableCredential", "WebsiteProfile"],
  issuer: "dns:example.com",
  credentialSubject: {
    id: "https://media.example.com/",
    type: "WebSite",
    name: "<Webサイトのタイトル>",
    description: "<Webサイトの説明>",
    image: {
      id: "https://media.example.com/image.png",
      digestSRI: "sha256-Upwn7gYMuRmJlD1ZivHk876vXHzokXrwXj50VgfnMnY=",
    },
    allowedOrigin: ["https://media.example.com"],
  },
} satisfies WebsiteProfile;

export class VcSign extends Command {
  static summary = "VC の作成";
  static description = `\
VC に署名します。
標準出力に VC を出力します。`;
  static flags = {
    identity: privateKey({ required: true }),
    id: opId(),
    input: Flags.string({
      summary: "入力ファイルのパス (JSON 形式)",
      helpValue: "<filepath>",
      description: `\
コアプロファイル (CP) の例:

${JSON.stringify(exampleCoreProfile, null, "  ")}

ウェブメディアプロファイル (WMP) の例:

${JSON.stringify(exampleWebMediaProfile, null, "  ")}

Website Profile (WSP) の例:

${JSON.stringify(exampleWebsiteProfile, null, "  ")}`,
      required: true,
    }),
    "issued-at": Flags.string({
      description: "発行日時 (ISO 8601)",
    }),
    "expired-at": expirationDate(),
  };
  static examples = [
    `\
$ <%= config.bin %> <%= command.id %> \\
    -i example.priv.json \\
    --id example.com \\
    --input core-profile.json`,
    `\
$ <%= config.bin %> <%= command.id %> \\
    -i example.priv.json \\
    --id example.org \\
    --input web-media-profile.json`,
    `\
$ <%= config.bin %> <%= command.id %> \\
    -i account-key.example.priv.json \\
    --input website-profile.example.json`,
  ];

  async run(): Promise<void> {
    const { flags } = await this.parse(VcSign);
    const inputBuffer = await fs.readFile(flags.input);
    const input = JSON.parse(inputBuffer.toString());
    const issuedAt: Date = new Date(flags["issued-at"] ?? Date.now());
    const expiredAt: Date = flags["expired-at"] ?? addYears(new Date(), 1);

    if (flags.id) {
      input.credentialSubject.id = flags.id;
    }

    const data = await addDigestSri(input);

    const vc = await signJwtVc(data, flags.identity, {
      issuedAt,
      expiredAt,
    });

    this.log(vc);
  }
}
