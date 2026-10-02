import {
  CaVerifier,
  CaVerifyFailed,
  verifyIntegrity,
} from "@originator-profile/verify";
import { expect } from "@wordpress/e2e-test-utils-playwright";
import { JSDOM } from "jsdom";
import { test } from "./local-ca";

const fixtures = [
  {
    name: "classic more",
    content: "<p>Intro</p><!--more--><p>Body</p>",
    pages: ["Intro\n\nBody"],
  },
  {
    name: "custom more link",
    content: "<p>Intro</p><!--more Read further--><p>Body</p>",
    pages: ["Intro\n\nBody"],
  },
  {
    name: "block more",
    content:
      "<!-- wp:paragraph --><p>Intro</p><!-- /wp:paragraph --><!-- wp:more --><!--more--><!-- /wp:more --><!-- wp:paragraph --><p>Body</p><!-- /wp:paragraph -->",
    pages: ["Intro\n\nBody"],
  },
  {
    name: "classic noteaser",
    content: "<p>Intro</p><!--more--><!--noteaser--><p>Body</p>",
    pages: ["Body"],
  },
  {
    name: "block noteaser",
    content:
      '<!-- wp:paragraph --><p>Intro</p><!-- /wp:paragraph --><!-- wp:more {"noTeaser":true} --><!--more--><!--noteaser--><!-- /wp:more --><!-- wp:paragraph --><p>Body</p><!-- /wp:paragraph -->',
    pages: ["Body"],
  },
  {
    name: "more with nextpage",
    content:
      "<p>Intro1</p><!--more--><p>Body1</p><!--nextpage--><p>Intro2</p><!--more--><p>Body2</p>",
    pages: ["Intro1\n\nBody1", "Intro2\n\nBody2"],
  },
  {
    name: "noteaser on second page",
    content:
      "<p>Intro1</p><!--more--><p>Body1</p><!--nextpage--><p>Intro2</p><!--more--><!--noteaser--><p>Body2</p>",
    pages: ["Body1", "Intro2\n\nBody2"],
  },
];

for (const fixture of fixtures) {
  test(`${fixture.name}: 表示・CA 検証・改ざん検出`, async ({
    page,
    baseURL,
    localCa,
  }) => {
    const nonce = await (
      await page.request.get(
        `${baseURL}wp-admin/admin-ajax.php?action=rest-nonce`,
      )
    ).text();
    // パーマリンク設定に依存しない REST URL で、認証済みユーザーの投稿を作成する.
    const response = await page.request.post(
      `${baseURL}?rest_route=/wp/v2/posts`,
      {
        headers: { "X-WP-Nonce": nonce },
        data: {
          title: fixture.name,
          content: fixture.content,
          status: "publish",
        },
      },
    );
    expect(response.status(), await response.text()).toBe(201);
    const post: { link: string } = await response.json();
    for (let index = 0; index < fixture.pages.length; index++) {
      const url = new URL(post.link);
      if (index) url.searchParams.set("page", String(index + 1));
      await page.goto(url.href);
      const cas = await page
        .locator('script[type="application/cas+json"]')
        .textContent();
      expect(cas).toBeTruthy();
      const jwt: string = JSON.parse(cas!)[0];
      expect(jwt, localCa.errors.join("; ")).toBeTruthy();
      const paragraphs = await page
        .locator(".wp-block-post-content > p")
        .allTextContents();
      expect(paragraphs.filter(Boolean).join("\n\n")).toBe(
        fixture.pages[index],
      );

      const submission = localCa.submissions.get(page.url());
      expect(
        submission,
        "ページに対応する CA 発行リクエストがあること",
      ).toBeDefined();
      const target = submission!.target[0];
      if (typeof target.content !== "string")
        throw new Error("Expected HTML content in CA request");
      const selector = target.cssSelector!;
      const signedDocument = new JSDOM(target.content).window.document;
      const signedHTML = Array.from(
        signedDocument.querySelectorAll(selector),
        (element) => element.outerHTML,
      ).join("");
      const displayedHTML = await page
        .locator(selector)
        .evaluateAll((elements) =>
          elements.map((element) => element.outerHTML).join(""),
        );
      expect(
        displayedHTML,
        "アンカーを含む表示 HTML と署名対象が一致すること",
      ).toBe(signedHTML);

      const document = new JSDOM(await page.content(), { url: page.url() })
        .window.document;
      const verify = (doc: Document) =>
        CaVerifier(
          jwt,
          localCa.keys,
          localCa.issuer,
          new URL(page.url()),
          (target) => verifyIntegrity(target, doc),
        )();
      expect(await verify(document)).not.toBeInstanceOf(Error);
      await page
        .locator(".wp-block-post-content > p")
        .first()
        .evaluate((element) => {
          element.textContent += " tampered";
        });
      const tampered = new JSDOM(await page.content(), { url: page.url() })
        .window.document;
      expect(await verify(tampered)).toBeInstanceOf(CaVerifyFailed);
    }
    expect(localCa.errors).toEqual([]);
  });
}
