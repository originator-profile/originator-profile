import type { Target } from "@originator-profile/model";
import { beforeEach, describe, expect, it } from "vitest";
import { createIntegrityMetadata, type HashAlgorithm } from "websri";
import {
  createIntegrity,
  fetchExternalResource,
  fetchHtmlContent,
  fetchTextContent,
  selectByCss,
  selectByIntegrity,
} from "./target-integrity";

describe("createIntegrity()", () => {
  beforeEach(() => {
    document.body.textContent = "ok";
  });

  it("should return a valid integrity", async () => {
    const integrityMetadata = await createIntegrityMetadata(
      "sha256",
      await new Response("ok").arrayBuffer(),
    );

    expect(
      await createIntegrity("sha256", {
        type: "TextTargetIntegrity",
        cssSelector: "body",
      }),
    ).toEqual({
      type: "TextTargetIntegrity",
      cssSelector: "body",
      integrity: integrityMetadata.toString(),
    });
  });

  it("should return a valid integrity for ExternalResourceTargetIntegrity with valid URL", async () => {
    const url = "data:text/plain,ok";
    const integrityMetadata = await createIntegrityMetadata(
      "sha256",
      await fetch(url).then((res) => res.arrayBuffer()),
    );

    expect(
      await createIntegrity("sha256", {
        type: "ExternalResourceTargetIntegrity",
        content: url,
      }),
    ).toEqual({
      type: "ExternalResourceTargetIntegrity",
      integrity: integrityMetadata.toString(),
    });
  });

  it("should return a valid integrity for ExternalResourceTargetIntegrity with inline content", async () => {
    const content = "ok";
    const integrityMetadata = await createIntegrityMetadata(
      "sha256",
      await new Response(content).arrayBuffer(),
    );

    expect(
      await createIntegrity("sha256", {
        type: "ExternalResourceTargetIntegrity",
        content,
      }),
    ).toEqual({
      type: "ExternalResourceTargetIntegrity",
      integrity: integrityMetadata.toString(),
    });
  });

  it("should return null if type is unsupported", async () => {
    expect(
      await createIntegrity("sha256", {
        type: "UnknownType" as Target["type"],
        cssSelector: "body",
      }),
    ).toBe(null);
  });

  it("should return null if no elements are selected", async () => {
    expect(
      await createIntegrity("sha256", {
        type: "TextTargetIntegrity",
        cssSelector: "non-existent-element",
      }),
    ).toBe(null);
  });

  it("should return null if integrity algorithm is unsupported", async () => {
    expect(
      await createIntegrity("md5" as HashAlgorithm, {
        type: "TextTargetIntegrity",
        cssSelector: "body",
      }),
    ).toBe(null);
  });

  it("should return valid integrity for ExternalResourceTargetIntegrity with multiple content URLs", async () => {
    const content = ["data:text/plain,content1", "data:text/plain,content2"];

    const meta1 = await createIntegrityMetadata(
      "sha256",
      await fetch(content[0]).then((res) => res.arrayBuffer()),
    );
    const meta2 = await createIntegrityMetadata(
      "sha256",
      await fetch(content[1]).then((res) => res.arrayBuffer()),
    );

    expect(
      await createIntegrity("sha256", {
        type: "ExternalResourceTargetIntegrity",
        content,
      }),
    ).toEqual({
      type: "ExternalResourceTargetIntegrity",
      integrity: `${meta1.toString()} ${meta2.toString()}`,
    });
  });

  it("should not reference document for ExternalResourceTargetIntegrity", async () => {
    const content = "data:text/plain,external-content";
    const integrityMetadata = await createIntegrityMetadata(
      "sha256",
      await fetch(content).then((res) => res.arrayBuffer()),
    );

    const invalidDoc = {} as Document;

    const result = await createIntegrity(
      "sha256",
      {
        type: "ExternalResourceTargetIntegrity",
        content,
      },
      invalidDoc,
    );

    expect(result).toEqual({
      type: "ExternalResourceTargetIntegrity",
      integrity: integrityMetadata.toString(),
    });
  });
});

describe("fetchHtmlContent()", () => {
  beforeEach(() => {
    document.body.innerHTML = `
<h1>Example Page</h1>
<p>Hello, World!</p>
`;
  });

  it("should fetch outerHTML", async () => {
    const elements = selectByCss({
      cssSelector: "body",
      integrity: "sha256-xxx",
      document,
    });

    const [res] = await fetchHtmlContent(elements);

    expect(await res.text()).toBe(
      `\
<body>
<h1>Example Page</h1>
<p>Hello, World!</p>
</body>`,
    );
  });

  it("should fetch outerHTML of all elements", async () => {
    const elements = selectByCss({
      cssSelector: "body > *",
      integrity: "sha256-xxx",
      document,
    });

    const [res] = await fetchHtmlContent(elements);

    expect(await res.text()).toBe(`<h1>Example Page</h1><p>Hello, World!</p>`);
  });
});

describe("fetchTextContent()", () => {
  beforeEach(() => {
    document.body.innerHTML = `
<h1>Example Page</h1>
<p>Hello, World!</p>
`;
  });

  it("should fetch textContent", async () => {
    const elements = selectByCss({
      cssSelector: "body",
      integrity: "sha256-xxx",
      document,
    });

    const [res] = await fetchTextContent(elements);

    expect(await res.text()).toBe(
      `\

Example Page
Hello, World!
`,
    );
  });

  it("should fetch textContent of all elements", async () => {
    const elements = selectByCss({
      cssSelector: "body > *",
      integrity: "sha256-xxx",
      document,
    });

    const [res] = await fetchTextContent(elements);

    expect(await res.text()).toBe(`Example PageHello, World!`);
  });
});

describe("fetchVisibleTextContent()", () => {
  it("should fetch innerText", async () => {
    document.body.textContent = `Hello, World!`;

    const elements = selectByCss({
      cssSelector: "body",
      integrity: "sha256-xxx",
      document,
    });

    const [res] = await fetchTextContent(elements);

    expect(await res.text()).toBe(`Hello, World!`);
  });
});

describe("fetchExternalResource()", () => {
  it("should fetch external resources using src attribute", async () => {
    document.body.innerHTML = `\
<img integrity="sha256-xxx" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==" />
`;

    const elements = selectByIntegrity({
      integrity: "sha256-xxx",
      document,
    });

    const [res] = await fetchExternalResource(elements);

    expect(await res.text()).toBe(
      `<svg xmlns="http://www.w3.org/2000/svg"></svg>`,
    );
  });

  it("should fetch external resources using currentSrc when available", async () => {
    document.body.innerHTML = `\
<video controls integrity="sha256-xxx">
  <source src="data:text/plain,currentSrcContent" />
</video>
`;

    const elements = selectByIntegrity({
      integrity: "sha256-xxx",
      document,
    });

    const [res] = await fetchExternalResource(elements);

    expect(await res.text()).toBe("currentSrcContent");
  });

  it("should fallback to src when currentSrc is empty", async () => {
    document.body.innerHTML = `\
<img integrity="sha256-xxx" src="data:text/plain,fallbackContent" />
`;

    const elements = selectByIntegrity({
      integrity: "sha256-xxx",
      document,
    });

    const [res] = await fetchExternalResource(elements);

    expect(await res.text()).toBe("fallbackContent");
  });

  it("should throw error when element has no src or currentSrc", async () => {
    document.body.innerHTML = `\
<div integrity="sha256-xxx"></div>
`;

    const elements = selectByIntegrity({
      integrity: "sha256-xxx",
      document,
    });

    await expect(fetchExternalResource(elements)).rejects.toThrow(
      "Element has no src or currentSrc property",
    );
  });
});

describe("selectByCss()", () => {
  beforeEach(() => {
    document.open();
    document.write(`<html><head></head><body>ok</body></html>`);
    document.close();
  });

  it("should select elements using CSS selector", () => {
    const elements = selectByCss({
      cssSelector: "body",
      integrity: "sha256-xxx",
      document,
    });

    expect(elements).toHaveLength(1);
    expect(elements[0].outerHTML).toBe(`<body>ok</body>`);
  });

  it("should return an empty array if no CSS selector is provided", () => {
    const elements = selectByCss({
      integrity: "sha256-xxx",
      document,
    });

    expect(elements).toEqual([]);
  });

  it("should return an empty array if no elements match the CSS selector", () => {
    const elements = selectByCss({
      cssSelector: "non-existent-element",
      integrity: "sha256-xxx",
      document,
    });

    expect(elements).toEqual([]);
  });
});

describe("selectByIntegrity()", () => {
  beforeEach(() => {
    document.body.innerHTML = `\
<img integrity="sha256-xxx" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==" />
`;
  });

  it("should select elements with matching integrity attribute", () => {
    const elements = selectByIntegrity({
      integrity: "sha256-xxx",
      document,
    });

    expect(elements).toHaveLength(1);
    expect(elements[0].outerHTML).toBe(
      `<img integrity="sha256-xxx" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==">`,
    );
  });

  it("should return an empty array if no elements match the integrity", () => {
    const elements = selectByIntegrity({
      integrity: "sha256-existent-integrity",
      document,
    });

    expect(elements).toEqual([]);
  });
});
