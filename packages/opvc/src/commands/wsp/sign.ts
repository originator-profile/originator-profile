import { Command, Flags } from "@oclif/core";
import type { UnsignedWebsiteProfile } from "@originator-profile/model";
import fs from "node:fs/promises";
import { expirationDate, privateKey } from "../../flags.ts";
import { sign } from "../../website-profile.ts";

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
} satisfies UnsignedWebsiteProfile;

const exampleMultilingualWebsiteProfile = [
  exampleWebsiteProfile,
  {
    ...exampleWebsiteProfile,
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://originator-profile.org/ns/credentials/v1",
      "https://originator-profile.org/ns/cip/v1",
      { "@language": "en" },
    ],
    credentialSubject: {
      ...exampleWebsiteProfile.credentialSubject,
      name: "<Website title>",
      description: "<Website description>",
    },
  },
] satisfies UnsignedWebsiteProfile[];

export class WspSign extends Command {
  static summary = "Website Profile の作成";
  static description = `\
Website Profile に署名します。
入力が単一オブジェクトの場合は JWT を、配列の場合は
{ "sites": ["<JWT>", ...], "originator": "<OP ID>" } を標準出力に出力します。
配列入力時は全要素が同一の issuer / credentialSubject.id を持ち、
@context の @language がそれぞれ異なる必要があります。`;
  static flags = {
    identity: privateKey({
      required: true,
    }),
    input: Flags.string({
      summary: "入力ファイルのパス (JSON 形式)",
      helpValue: "<filepath>",
      description: `\
Website Profile (WSP) の例:

${JSON.stringify(exampleWebsiteProfile, null, "  ")}

多言語 Website Profile (配列) の例:

${JSON.stringify(exampleMultilingualWebsiteProfile, null, "  ")}`,
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
    -i account-key.example.priv.json \\
    --input website-profile.example.json`,
    `\
$ <%= config.bin %> <%= command.id %> \\
    -i account-key.example.priv.json \\
    --input website-profile.multilingual.example.json`,
  ];

  async run(): Promise<void> {
    const { flags } = await this.parse(WspSign);
    const inputBuffer = await fs.readFile(flags.input);

    const input: UnsignedWebsiteProfile | UnsignedWebsiteProfile[] = JSON.parse(
      inputBuffer.toString(),
    );

    if (Array.isArray(input)) {
      const result = await sign(input, flags.identity, {
        issuedAt: flags["issued-at"],
        expiredAt: flags["expired-at"],
      });
      this.logJson(result);
    } else {
      const jwt = await sign(input, flags.identity, {
        issuedAt: flags["issued-at"],
        expiredAt: flags["expired-at"],
      });
      this.log(jwt);
    }
  }
}
