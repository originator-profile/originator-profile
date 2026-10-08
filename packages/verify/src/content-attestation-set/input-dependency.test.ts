import { generateKey } from "@originator-profile/cryptography";
import { signCa } from "@originator-profile/sign";
import { describe, expect, test } from "vitest";
import { article, patch } from "../helper";
import { signOptions } from "../originator-profile-set/helper";
import { listInputDependencies } from "./input-dependency";

describe("listInputDependencies", () => {
  test("target の種類ごとの入力依存対象を列挙する", async () => {
    const { privateKey } = await generateKey();
    const integrity = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
    const ca = await signCa(
      patch(article, [
        {
          op: "add",
          path: ["target", 0],
          value: { type: "TextTargetIntegrity", cssSelector: "p", integrity },
        },
        {
          op: "add",
          path: ["target", 1],
          value: {
            type: "VisibleTextTargetIntegrity",
            cssSelector: "p",
            integrity,
          },
        },
        {
          op: "add",
          path: ["target", 2],
          value: { type: "ExternalResourceTargetIntegrity", integrity },
        },
      ]),
      privateKey,
      signOptions,
    );

    expect(listInputDependencies([{ main: true, attestation: ca }])).toEqual([
      { pointer: "$.cas[0].attestation.target[0]", dependency: "parsed-dom" },
      {
        pointer: "$.cas[0].attestation.target[1]",
        dependency: "rendered-result",
      },
      { pointer: "$.cas[0].attestation.target[2]", dependency: "response" },
    ]);
  });

  test("復号できない CA は無視する", () => {
    expect(listInputDependencies(["not-a-jwt"])).toEqual([]);
  });
});
