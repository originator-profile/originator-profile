import { Command, Flags } from "@oclif/core";
import type { UnsignedWebsiteProfile } from "@originator-profile/model";
import fs from "node:fs/promises";
import { expirationDate } from "../../flags.ts";
import { unsignedWsp } from "../../website-profile.ts";

const exampleWebsiteProfile = {
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://originator-profile.org/ns/credentials/v1",
    "https://originator-profile.org/ns/cip/v1",
    {
      "@language": "<言語・地域コード>",
    },
  ],
  type: ["VerifiableCredential", "WebsiteProfile"],
  issuer: "<OP ID>",
  credentialSubject: {
    id: "<Web サイトのオリジン (形式: https://<ホスト名>)>",
    type: "WebSite",
    name: "<Web サイトの名称>",
    description: "<Web サイトの説明>",
    image: {
      id: "<サムネイル画像URL>",
      content: ["<コンテンツ (data:// 形式URL)>"],
    },
    allowedOrigin: ["<Web サイトのオリジン (形式: https://<ホスト名>)>"],
  },
} satisfies UnsignedWebsiteProfile;

const exampleMultilingualWebsiteProfile = [
  {
    ...exampleWebsiteProfile,
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://originator-profile.org/ns/credentials/v1",
      "https://originator-profile.org/ns/cip/v1",
      { "@language": "ja" },
    ],
  },
  {
    ...exampleWebsiteProfile,
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      "https://originator-profile.org/ns/credentials/v1",
      "https://originator-profile.org/ns/cip/v1",
      { "@language": "en" },
    ],
  },
] satisfies UnsignedWebsiteProfile[];

export class WspUnsigned extends Command {
  static summary = "未署名 Website Profile の取得";
  static description = "標準出力に未署名 Website Profile を出力します。";
  static flags = {
    input: Flags.string({
      summary: "入力ファイルのパス (JSON 形式)",
      helpValue: "<filepath>",
      description: `\
Website Profile の例:

${JSON.stringify(exampleWebsiteProfile, null, "  ")}

多言語の Website Profile (配列) の例:

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
    --input website-profile.example.json`,
  ];

  async run(): Promise<void> {
    const { flags } = await this.parse(WspUnsigned);
    const inputBuffer = await fs.readFile(flags.input);

    const input: UnsignedWebsiteProfile | UnsignedWebsiteProfile[] = JSON.parse(
      inputBuffer.toString(),
    );
    const options = {
      issuedAt: flags["issued-at"],
      expiredAt: flags["expired-at"],
    };

    const uwsp = Array.isArray(input)
      ? await unsignedWsp(input, options)
      : await unsignedWsp(input, options);

    this.logJson(uwsp);
  }
}
