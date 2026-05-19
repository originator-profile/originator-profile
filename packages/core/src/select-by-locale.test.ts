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

  test("VCの@languageが地域コード付き(ja-JP)の場合、ユーザーロケールjaで一致する", () => {
    const vcJaJP = {
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        {
          "@language": "ja-JP",
        },
      ],
      type: ["VerifiableCredential"],
      credentialSubject: {
        name: "日本語(ja-JP)コンテンツ",
      },
    };

    vi.stubGlobal("navigator", { language: "ja-JP" });
    const result = selectByLocale([vcJaJP, vcEn]);
    expect(result).toBe(vcJaJP);
  });

  test("VCの@languageが地域コード付き(en-US)の場合、ユーザーロケールenで一致する", () => {
    const vcEnUS = {
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        {
          "@language": "en-US",
        },
      ],
      type: ["VerifiableCredential"],
      credentialSubject: {
        name: "English(en-US) Content",
      },
    };

    vi.stubGlobal("navigator", { language: "en-US" });
    const result = selectByLocale([vcJa, vcEnUS]);
    expect(result).toBe(vcEnUS);
  });

  test("VCの@languageがja-JP、ユーザーロケールがjaの場合、一致すべき", () => {
    const vcJaJP = {
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        {
          "@language": "ja-JP",
        },
      ],
      type: ["VerifiableCredential"],
      credentialSubject: {
        name: "日本語(ja-JP)コンテンツ",
      },
    };

    vi.stubGlobal("navigator", { language: "ja" });
    const result = selectByLocale([vcJaJP, vcEn]);
    expect(result).toBe(vcJaJP);
  });

  // 地域コード優先度のテスト
  describe("地域コードの優先度 (BCP 47)", () => {
    const vcEnGB = {
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        { "@language": "en-GB" },
      ],
      type: ["VerifiableCredential"],
      credentialSubject: { name: "British English" },
    };

    const vcEnBase = {
      "@context": [
        "https://www.w3.org/ns/credentials/v2",
        { "@language": "en" },
      ],
      type: ["VerifiableCredential"],
      credentialSubject: { name: "Generic English" },
    };

    test("ユーザーロケールがen-GBの場合、en-GB > enの優先度で選択", () => {
      vi.stubGlobal("navigator", { language: "en-GB" });
      const result = selectByLocale([vcEnBase, vcEnGB]);
      expect(result).toBe(vcEnGB);
    });

    test("ユーザーロケールがenの場合、en > en-GBの優先度で選択", () => {
      vi.stubGlobal("navigator", { language: "en" });
      const result = selectByLocale([vcEnGB, vcEnBase]);
      expect(result).toBe(vcEnBase);
    });

    test("ユーザーロケールがen-USの場合、enにフォールバック", () => {
      vi.stubGlobal("navigator", { language: "en-US" });
      const result = selectByLocale([vcJa, vcEnBase]);
      expect(result).toBe(vcEnBase);
    });

    test("ユーザーロケールがen-USの場合、en-GBよりenを優先", () => {
      vi.stubGlobal("navigator", { language: "en-US" });
      const result = selectByLocale([vcEnGB, vcEnBase]);
      expect(result).toBe(vcEnBase);
    });

    test("ユーザーロケールがen-GBで、en-GBがなければenにフォールバック", () => {
      vi.stubGlobal("navigator", { language: "en-GB" });
      const result = selectByLocale([vcJa, vcEnBase]);
      expect(result).toBe(vcEnBase);
    });
  });
});

describe("selectByLocale (group オプション)", () => {
  const certAJa = {
    "@context": ["https://www.w3.org/ns/credentials/v2", { "@language": "ja" }],
    issuer: "did:example:issuer",
    credentialSubject: {
      id: "did:example:subject",
      certificationSystem: { id: "urn:cert:A" },
      name: "認証A 日本語",
    },
  };

  const certAEn = {
    "@context": ["https://www.w3.org/ns/credentials/v2", { "@language": "en" }],
    issuer: "did:example:issuer",
    credentialSubject: {
      id: "did:example:subject",
      certificationSystem: { id: "urn:cert:A" },
      name: "Certificate A English",
    },
  };

  const certBJa = {
    "@context": ["https://www.w3.org/ns/credentials/v2", { "@language": "ja" }],
    issuer: "did:example:issuer",
    credentialSubject: {
      id: "did:example:subject",
      certificationSystem: { id: "urn:cert:B" },
      name: "認証B 日本語",
    },
  };

  const certBEn = {
    "@context": ["https://www.w3.org/ns/credentials/v2", { "@language": "en" }],
    issuer: "did:example:issuer",
    credentialSubject: {
      id: "did:example:subject",
      certificationSystem: { id: "urn:cert:B" },
      name: "Certificate B English",
    },
  };

  const group = (c: {
    issuer: string;
    credentialSubject: { id: string; certificationSystem: { id: string } };
  }) =>
    JSON.stringify([
      c.issuer,
      c.credentialSubject.id,
      c.credentialSubject.certificationSystem.id,
    ]);

  test("空配列の場合は空配列を返す", () => {
    const result = selectByLocale([], { group });
    expect(result).toEqual([]);
  });

  test("同じグループの言語違いVCから、ユーザーロケールに合致するVCのみを返す", () => {
    vi.stubGlobal("navigator", { language: "ja-JP" });
    const result = selectByLocale([certAEn, certAJa, certBEn, certBJa], {
      group,
    });
    expect(result).toEqual([certAJa, certBJa]);
  });

  test("英語ロケールでは英語版のみを返す", () => {
    vi.stubGlobal("navigator", { language: "en-US" });
    const result = selectByLocale([certAEn, certAJa, certBEn, certBJa], {
      group,
    });
    expect(result).toEqual([certAEn, certBEn]);
  });

  test("グループは入力配列での出現順を保持する", () => {
    vi.stubGlobal("navigator", { language: "ja-JP" });
    const result = selectByLocale([certBEn, certAEn, certBJa, certAJa], {
      group,
    });
    expect(result).toEqual([certBJa, certAJa]);
  });

  test("1グループに1要素しかない場合はその要素を返す", () => {
    vi.stubGlobal("navigator", { language: "ja-JP" });
    const result = selectByLocale([certAEn, certBJa], { group });
    expect(result).toEqual([certAEn, certBJa]);
  });
});
