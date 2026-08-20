import { afterEach, expect, test, vi } from "vitest";
import { CaClientError, CaClientErrorCode } from "../errors";
import { documentProvider } from "./document-provider";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("documentProvider: parses inline HTML", async () => {
  const document = await documentProvider({
    type: "TextTargetIntegrity",
    content: "<body><main>hello</main></body>",
  });

  expect(document.querySelector("main")?.textContent).toBe("hello");
});

test("documentProvider: fetches HTML when content is a URL", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response("<body><main>from-url</main></body>", { status: 200 }),
    ),
  );

  const document = await documentProvider({
    type: "HtmlTargetIntegrity",
    content: "https://example.com/article",
  });

  expect(document.querySelector("main")?.textContent).toBe("from-url");
});

test("documentProvider: wraps network failures as HTTP errors", async () => {
  const cause = new TypeError("Failed to fetch");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw cause;
    }),
  );

  const error = await documentProvider({
    type: "TextTargetIntegrity",
    content: "https://example.com/article",
  }).then(
    () => null,
    (e: unknown) => e,
  );

  expect(error).toBeInstanceOf(CaClientError);
  expect(error).toMatchObject({
    message: "Failed to fetch document: Failed to fetch",
    code: CaClientErrorCode.Http,
    cause,
  });
});

test("documentProvider: wraps non-OK HTTP responses as HTTP errors", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response("not found", { status: 404, statusText: "Not Found" }),
    ),
  );

  await expect(
    documentProvider({
      type: "TextTargetIntegrity",
      content: "https://example.com/article",
    }),
  ).rejects.toMatchObject({
    message: "Failed to fetch document: 404 Not Found",
    code: CaClientErrorCode.Http,
    status: 404,
  });
});

test("documentProvider: rejects unsupported target types and multiple contents", async () => {
  await expect(
    documentProvider({
      type: "ExternalResourceTargetIntegrity",
      content: "https://example.com/image.png",
    }),
  ).rejects.toMatchObject({
    code: CaClientErrorCode.Validation,
  });

  await expect(
    documentProvider({
      type: "TextTargetIntegrity",
      content: ["<p>a</p>", "<p>b</p>"],
    }),
  ).rejects.toMatchObject({
    code: CaClientErrorCode.Validation,
  });
});
