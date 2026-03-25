import { OriginatorProfile, SiteProfile } from "@originator-profile/model";
import { Window } from "happy-dom";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import { SiteProfileFetchFailed, SiteProfileFetchInvalid } from "./errors";
import { fetchSiteProfile } from "./fetch-site-profile";

const server = setupServer();

const ops: OriginatorProfile = {
  core: "eyJ...",
  annotations: ["eyJ..."],
  media: ["eyJ..."],
};

const credential = "eyJ...";

const siteProfile = {
  originators: [ops],
  credential,
};

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

test("Ssite Profile のあるサイトで Site Profile が得られる", async () => {
  const endpoint = "https://example.com/.well-known/sp.json";
  server.use(
    http.get(endpoint, () => {
      return HttpResponse.json(siteProfile);
    }),
  );

  const window = new Window({ url: "https://example.com" });
  window.document.body.innerHTML = `
<body></body>`;
  const result = await fetchSiteProfile(window.document as unknown as Document);
  expect(result).toEqual({
    result: siteProfile,
    origin: "https://example.com",
  });
});

test("複数の Site Profile を提示されたとき無効", async () => {
  const endpoint = "https://example.com/.well-known/sp.json";
  const sp: [SiteProfile] = [siteProfile];
  server.use(
    http.get(endpoint, () => {
      return HttpResponse.json(sp);
    }),
  );

  const window = new Window({ url: "https://example.com" });
  window.document.body.innerHTML = `
<body></body>`;
  const result = await fetchSiteProfile(window.document as unknown as Document);
  expect(result).toBeInstanceOf(SiteProfileFetchInvalid);
});

test("Site Profile が設置されていないとき Site Profile の取得に失敗", async () => {
  const endpoint = "https://error.example.org/.well-known/sp.json";
  server.use(http.get(endpoint, () => new HttpResponse(null, { status: 404 })));

  const window = new Window({ url: "https://error.example.org" });
  window.document.body.innerHTML = ` <body></body>`;
  const result = await fetchSiteProfile(window.document as unknown as Document);
  expect(result).toBeInstanceOf(SiteProfileFetchFailed);
  // @ts-expect-error result is WebsiteMetadataFetchFailed
  expect(result.message).toBe("Site Profile fetch failed");
  expect((result as SiteProfileFetchFailed).result.error?.message).toBe(
    "HTTP status code 404",
  );
});

test("Site Profile の JSON parse に失敗したときエラーが返る", async () => {
  const profileEndpoint = "https://error.example.org/.well-known/sp.json";
  server.use(
    http.get(profileEndpoint, () => HttpResponse.text("<html></html>")),
  );

  const window = new Window({ url: "https://not-json.example.org" });
  window.document.body.innerHTML = `
    <body></body>`;
  const result = await fetchSiteProfile(window.document as unknown as Document);
  expect(result).toBeInstanceOf(SiteProfileFetchFailed);
  // @ts-expect-error result is WebsiteMetadataFetchFailed
  expect(result.message).toContain(`Site Profile fetch failed:`);
});
