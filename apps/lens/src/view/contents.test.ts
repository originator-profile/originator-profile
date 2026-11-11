import { describe, expect, test } from "vitest";
import { contentsOf, sectionsOf } from "./contents";
import { ca, subFrame, topFrame } from "./test-fixtures";

const publisher = "dns:publisher.example";
const advertiser = "dns:advertiser.example";

const article = (id: string, main = false) => ({
  main,
  attestation: ca(publisher, id) as never,
});
const advertorial = (id: string, main = false) => ({
  main,
  attestation: ca(publisher, id, { type: "Advertorial" }) as never,
});
const ad = (id: string) => ({
  main: false,
  attestation: ca(advertiser, id, { type: "OnlineAd", title: "Ad" }) as never,
});

describe("contentsOf", () => {
  test("メインを先頭に、広告を最後に並べる", () => {
    const contents = contentsOf([
      {
        frame: topFrame,
        cas: [ad("ad"), advertorial("advertorial"), article("main", true)],
      },
      { frame: subFrame, cas: [article("article")] },
    ]);
    expect(
      contents.map(({ attestation }) => attestation.credentialSubject.id),
    ).toEqual(["main", "article", "advertorial", "ad"]);
  });

  test("発行者と CA ID が同じものは 1 つにまとめ、出ているフレームをすべて持つ", () => {
    const contents = contentsOf([
      { frame: topFrame, cas: [article("same"), article("same")] },
      { frame: subFrame, cas: [article("same")] },
    ]);
    expect(contents).toHaveLength(1);
    expect(contents[0]?.frames).toEqual([topFrame, subFrame]);
  });

  test("復号できなかった CA は除く", () => {
    const contents = contentsOf([
      { frame: topFrame, cas: [{ main: true, attestation: null }] },
    ]);
    expect(contents).toEqual([]);
  });

  test("タイトルとサムネイルを型に応じて取り出す", () => {
    const [advertisement, articleContent] = contentsOf([
      { frame: topFrame, cas: [ad("ad"), article("article")] },
    ]).toReversed();
    expect(articleContent).toMatchObject({
      title: "article",
      image: "article/thumbnail.png",
    });
    expect(advertisement).toMatchObject({
      title: "Ad",
      image: "ad/thumbnail.png",
    });
  });
});

describe("sectionsOf", () => {
  test("メインのコンテンツの区分を先頭にまとめる", () => {
    const sections = sectionsOf(
      contentsOf([
        {
          frame: topFrame,
          cas: [article("article"), advertorial("main", true), ad("ad")],
        },
      ]),
    );
    expect(
      sections.map(({ category, contents }) => [category, contents.length]),
    ).toEqual([
      ["advertorial", 1],
      ["article", 1],
      ["advertisement", 1],
    ]);
  });
});
