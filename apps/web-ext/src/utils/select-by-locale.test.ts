import { describe, expect, test, vi } from "vitest";
import { selectByLocale } from "./select-by-locale";

describe("selectByLocale", () => {
  const vcJa = {
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      {
        "@language": "ja",
      },
    ],
    type: ["VerifiableCredential"],
    credentialSubject: {
      name: "日本語コンテンツ",
    },
  };

  const vcEn = {
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      {
        "@language": "en",
      },
    ],
    type: ["VerifiableCredential"],
    credentialSubject: {
      name: "English Content",
    },
  };

  const vcFr = {
    "@context": [
      "https://www.w3.org/ns/credentials/v2",
      {
        "@language": "fr",
      },
    ],
    type: ["VerifiableCredential"],
    credentialSubject: {
      name: "Contenu français",
    },
  };

  const vcNoLang = {
    "@context": ["https://www.w3.org/ns/credentials/v2"],
    type: ["VerifiableCredential"],
    credentialSubject: {
      name: "No language specified",
    },
  };

  test("空配列の場合はundefinedを返す", () => {
    const result = selectByLocale([]);
    expect(result).toBeUndefined();
  });

  test("単一要素の場合はその要素を返す", () => {
    const result = selectByLocale([vcJa]);
    expect(result).toBe(vcJa);
  });

  test("ユーザーロケールに一致するVCを返す (ja)", () => {
    vi.stubGlobal("navigator", { language: "ja-JP" });
    const result = selectByLocale([vcEn, vcJa, vcFr]);
    expect(result).toBe(vcJa);
  });

  test("ユーザーロケールに一致するVCを返す (en)", () => {
    vi.stubGlobal("navigator", { language: "en-US" });
    const result = selectByLocale([vcJa, vcEn, vcFr]);
    expect(result).toBe(vcEn);
  });

  test("ユーザーロケールに一致するVCを返す (fr)", () => {
    vi.stubGlobal("navigator", { language: "fr-FR" });
    const result = selectByLocale([vcJa, vcEn, vcFr]);
    expect(result).toBe(vcFr);
  });

  test("一致しない場合は英語にフォールバック", () => {
    vi.stubGlobal("navigator", { language: "de-DE" });
    const result = selectByLocale([vcJa, vcEn, vcFr]);
    expect(result).toBe(vcEn);
  });

  test("英語もない場合は最初の要素にフォールバック", () => {
    vi.stubGlobal("navigator", { language: "de-DE" });
    const result = selectByLocale([vcJa, vcFr]);
    expect(result).toBe(vcJa);
  });

  test("言語タグがないVCが混在している場合も正しく処理", () => {
    vi.stubGlobal("navigator", { language: "ja-JP" });
    const result = selectByLocale([vcNoLang, vcEn, vcJa]);
    expect(result).toBe(vcJa);
  });

  test("すべてのVCに言語タグがない場合は最初の要素を返す", () => {
    vi.stubGlobal("navigator", { language: "ja-JP" });
    const result = selectByLocale([vcNoLang, vcNoLang]);
    expect(result).toBe(vcNoLang);
  });

  test("ロケールコードが地域付きの場合も正しく処理 (en-GB)", () => {
    vi.stubGlobal("navigator", { language: "en-GB" });
    const result = selectByLocale([vcJa, vcEn, vcFr]);
    expect(result).toBe(vcEn);
  });

  test("複数の同じ言語のVCがある場合は最初に見つかったものを返す", () => {
    const vcJa2 = { ...vcJa, credentialSubject: { name: "日本語コンテンツ2" } };
    vi.stubGlobal("navigator", { language: "ja-JP" });
    const result = selectByLocale([vcJa, vcJa2, vcEn]);
    expect(result).toBe(vcJa);
  });
});
