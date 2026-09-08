import { expect, test, vi } from "vitest";
import { CaClientError, CaClientErrorCode } from "../errors";
import type { FetchOperations } from "../fetch-operations";
import { documentProvider } from "./document-provider";

test("documentProvider: parses inline HTML", async () => {
  const document = await documentProvider({
    type: "TextTargetIntegrity",
    content: "<body><main>hello</main></body>",
  });

  expect(document.querySelector("main")?.textContent).toBe("hello");
});

test("documentProvider: fetches HTML when content is a URL", async () => {
  const fetchOps: FetchOperations = {
    fetch: vi.fn(
      async () =>
        new Response("<body><main>from-url</main></body>", { status: 200 }),
    ),
  };

  const document = await documentProvider(
    {
      type: "HtmlTargetIntegrity",
      content: "https://example.com/article",
    },
    fetchOps,
  );

  expect(document.querySelector("main")?.textContent).toBe("from-url");
  expect(fetchOps.fetch).toHaveBeenCalledWith("https://example.com/article");
});

test("documentProvider: wraps network failures as HTTP errors", async () => {
  const cause = new TypeError("Failed to fetch");
  const fetchOps: FetchOperations = {
    fetch: vi.fn(async () => {
      throw cause;
    }),
  };

  const error = await documentProvider(
    {
      type: "TextTargetIntegrity",
      content: "https://example.com/article",
    },
    fetchOps,
  ).then(
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
  const fetchOps: FetchOperations = {
    fetch: vi.fn(
      async () =>
        new Response("not found", { status: 404, statusText: "Not Found" }),
    ),
  };

  await expect(
    documentProvider(
      {
        type: "TextTargetIntegrity",
        content: "https://example.com/article",
      },
      fetchOps,
    ),
  ).rejects.toMatchObject({
    message: "Failed to fetch document: 404 Not Found",
    code: CaClientErrorCode.Http,
    status: 404,
  });
});

test("documentProvider: treats empty or omitted content as empty HTML", async () => {
  const fromEmptyArray = await documentProvider({
    type: "TextTargetIntegrity",
    content: [],
  });
  const fromEmptyString = await documentProvider({
    type: "TextTargetIntegrity",
    content: "",
  });
  const fromOmitted = await documentProvider({
    type: "TextTargetIntegrity",
  });

  expect(fromEmptyArray.body?.textContent).toBe("");
  expect(fromEmptyString.body?.textContent).toBe("");
  expect(fromOmitted.body?.textContent).toBe("");
});

test("documentProvider: parses a single-element content array", async () => {
  const document = await documentProvider({
    type: "TextTargetIntegrity",
    content: ["<body><main>hello</main></body>"],
  });

  expect(document.querySelector("main")?.textContent).toBe("hello");
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
