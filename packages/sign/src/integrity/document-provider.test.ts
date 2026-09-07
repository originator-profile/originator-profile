import { describe, expect, it, vi } from "vitest";
import { createDocumentProvider } from "./document-provider";
import { FetchFailed, UnsupportedDocumentTarget } from "./error";

function parseDocument(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("createDocumentProvider()", () => {
  it("parses inline HTML", async () => {
    const documentProvider = createDocumentProvider({ parseDocument });

    const document = await documentProvider({
      type: "TextTargetIntegrity",
      content: "<body><main>hello</main></body>",
    });

    expect(document.querySelector("main")?.textContent).toBe("hello");
  });

  it("fetches HTML when content is a URL", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response("<body><main>from-url</main></body>", { status: 200 }),
    );
    const parsed = vi.fn(parseDocument);
    const documentProvider = createDocumentProvider({
      fetch: fetcher,
      parseDocument: parsed,
    });

    const document = await documentProvider({
      type: "HtmlTargetIntegrity",
      content: "https://example.com/article",
    });

    expect(document.querySelector("main")?.textContent).toBe("from-url");
    expect(fetcher).toHaveBeenCalledWith("https://example.com/article");
    expect(parsed).toHaveBeenCalledWith(
      "<body><main>from-url</main></body>",
      "https://example.com/article",
    );
  });

  it("does not treat non-OK HTTP responses as failures", async () => {
    const documentProvider = createDocumentProvider({
      fetch: async () =>
        new Response("<body><main>not found</main></body>", { status: 404 }),
      parseDocument,
    });

    const document = await documentProvider({
      type: "TextTargetIntegrity",
      content: "https://example.com/article",
    });

    expect(document.querySelector("main")?.textContent).toBe("not found");
  });

  it("wraps fetch failures as FetchFailed", async () => {
    const cause = new TypeError("Failed to fetch");
    const documentProvider = createDocumentProvider({
      fetch: async () => {
        throw cause;
      },
      parseDocument,
    });

    const error = await documentProvider({
      type: "TextTargetIntegrity",
      content: "https://example.com/article",
    }).then(
      () => null,
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(FetchFailed);
    expect(error).toMatchObject({
      message: "Failed to fetch",
      error: cause,
    });
  });

  it("treats empty or omitted content as empty HTML", async () => {
    const documentProvider = createDocumentProvider({ parseDocument });

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

  it("parses a single-element content array", async () => {
    const documentProvider = createDocumentProvider({ parseDocument });

    const document = await documentProvider({
      type: "TextTargetIntegrity",
      content: ["<body><main>hello</main></body>"],
    });

    expect(document.querySelector("main")?.textContent).toBe("hello");
  });

  it("rejects unsupported target types and multiple contents", async () => {
    const documentProvider = createDocumentProvider({ parseDocument });

    await expect(
      documentProvider({
        type: "ExternalResourceTargetIntegrity",
        content: "https://example.com/image.png",
      }),
    ).rejects.toBeInstanceOf(UnsupportedDocumentTarget);

    await expect(
      documentProvider({
        type: "TextTargetIntegrity",
        content: ["<p>a</p>", "<p>b</p>"],
      }),
    ).rejects.toBeInstanceOf(UnsupportedDocumentTarget);
  });
});
