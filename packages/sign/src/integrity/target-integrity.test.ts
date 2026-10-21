import type { Target } from "@originator-profile/model";
import { beforeEach, describe, expect, it } from "vitest";
import { createIntegrityMetadata, type HashAlgorithm } from "websri";
import {
  createIntegrity,
  fetchExternalResource,
  fetchHtmlContent,
  fetchTextContent,
  resolveExternalResourceUrls,
  selectByCss,
  selectByCssOrIntegrity,
  selectByIntegrity,
  selectExternalResources,
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

  it("should keep cssSelector for ExternalResourceTargetIntegrity", async () => {
    const url = "data:text/plain,ok";
    const integrityMetadata = await createIntegrityMetadata(
      "sha256",
      await fetch(url).then((res) => res.arrayBuffer()),
    );

    expect(
      await createIntegrity("sha256", {
        type: "ExternalResourceTargetIntegrity",
        content: url,
        cssSelector: "#hero-image",
      }),
    ).toEqual({
      type: "ExternalResourceTargetIntegrity",
      cssSelector: "#hero-image",
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

  it("should fetch all srcset candidates of source element in picture element", async () => {
    document.body.innerHTML = `\
<picture>
  <source integrity="sha256-xxx" srcset="data:text/plain,small 1x, data:text/plain,large 2x" />
  <img src="data:text/plain,image" />
</picture>
`;

    const elements = selectByIntegrity({
      integrity: "sha256-xxx",
      document,
    });

    const responses = await fetchExternalResource(elements);

    expect(await Promise.all(responses.map((res) => res.text()))).toEqual([
      "small",
      "large",
    ]);
  });

  it("should throw error when element is not a target element", async () => {
    document.body.innerHTML = `\
<div integrity="sha256-xxx"></div>
`;

    const elements = selectByIntegrity({
      integrity: "sha256-xxx",
      document,
    });

    await expect(fetchExternalResource(elements)).rejects.toThrow(
      "<div> is not a target element of External Resource Integrity",
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

describe("selectByCssOrIntegrity()", () => {
  const src =
    "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==";

  beforeEach(() => {
    document.body.innerHTML = `\
<img class="hero" integrity="sha256-yyy" src="${src}" />
<img integrity="sha256-xxx" src="${src}" />
<img class="hero" src="${src}" />
`;
  });

  it("should select elements by CSS selector even if the integrity attribute does not match", () => {
    const elements = selectByCssOrIntegrity({
      cssSelector: ".hero",
      integrity: "sha256-xxx",
      document,
    });

    expect(elements).toHaveLength(2);
    expect(
      elements.every((element) => element.classList.contains("hero")),
    ).toBe(true);
  });

  it("should select elements by the integrity attribute if no CSS selector is provided", () => {
    const elements = selectByCssOrIntegrity({
      integrity: "sha256-xxx",
      document,
    });

    expect(elements).toHaveLength(1);
    expect(elements[0].getAttribute("integrity")).toBe("sha256-xxx");
  });

  it("should throw if the CSS selector has a syntax error", () => {
    expect(() =>
      selectByCssOrIntegrity({
        cssSelector: "[",
        integrity: "sha256-xxx",
        document,
      }),
    ).toThrow();
  });

  it("should throw if the CSS selector is an empty string", () => {
    expect(() =>
      selectByCssOrIntegrity({
        cssSelector: "",
        integrity: "sha256-xxx",
        document,
      }),
    ).toThrow();
  });
});

describe("resolveExternalResourceUrls()", () => {
  const resolve = (selector: string) =>
    resolveExternalResourceUrls(document.querySelector(selector) as Element);

  it.each([
    ["img", `<img src="data:text/plain,image" />`, ["data:text/plain,image"]],
    [
      "video",
      `<video src="data:text/plain,video"></video>`,
      ["data:text/plain,video"],
    ],
    [
      "audio",
      `<audio src="data:text/plain,audio"></audio>`,
      ["data:text/plain,audio"],
    ],
    [
      "track",
      `<video><track src="data:text/plain,caption" /></video>`,
      ["data:text/plain,caption"],
    ],
    [
      "picture",
      `<picture><source srcset="data:text/plain,large" /><img src="data:text/plain,image" /></picture>`,
      ["data:text/plain,image"],
    ],
  ])("should resolve the URL of %s element", (selector, html, expected) => {
    document.body.innerHTML = html;

    expect(resolve(selector)).toEqual(expected);
  });

  it("should resolve all srcset candidates of source element in picture element whether or not it is selected", () => {
    document.body.innerHTML = `\
<picture>
  <source srcset="data:text/plain,small 1x, data:text/plain,large 2x" />
  <img src="data:text/plain,image" />
</picture>
`;

    expect(resolve("source")).toEqual([
      "data:text/plain,small",
      "data:text/plain,large",
    ]);
  });

  it("should parse srcset candidates containing commas in the URL", () => {
    document.body.innerHTML = `\
<picture>
  <source srcset="data:text/plain,a 1x,data:text/plain,b 2x" />
  <img src="data:text/plain,b" />
</picture>
`;

    expect(resolve("source")).toEqual([
      "data:text/plain,a",
      "data:text/plain,b",
    ]);
  });

  it("should resolve the URL of source element in video element whether or not it is selected", () => {
    document.body.innerHTML = `\
<video>
  <source id="selected" src="data:text/plain,selected" />
  <source id="unselected" src="data:text/plain,unselected" />
</video>
`;

    expect(resolve("#selected")).toEqual(["data:text/plain,selected"]);
    expect(resolve("#unselected")).toEqual(["data:text/plain,unselected"]);
  });

  it.each([
    ["iframe", `<iframe src="data:text/plain,page"></iframe>`],
    [
      "script",
      `<script type="text/plain" src="data:text/plain,script"></script>`,
    ],
    ["embed", `<embed src="data:text/plain,image" type="image/svg+xml" />`],
    ["div", `<div></div>`],
    ["a", `<a href="data:text/plain,image">link</a>`],
    ["img", `<img />`],
    ["picture", `<picture></picture>`],
    ["source", `<video><source /></video>`],
    [
      "source",
      `<picture><source /><img src="data:text/plain,image" /></picture>`,
    ],
    ["source", `<div><source src="data:text/plain,source" /></div>`],
  ])("should not resolve the URL of %s element", (selector, html) => {
    document.body.innerHTML = html;

    expect(resolve(selector)).toEqual([]);
  });
});

describe("selectExternalResources()", () => {
  it("should exclude elements that are not target elements", () => {
    document.body.innerHTML = `\
<img integrity="sha256-xxx" src="data:text/plain,image" />
<iframe integrity="sha256-xxx" src="data:text/plain,page"></iframe>
<div integrity="sha256-xxx"></div>
`;

    const elements = selectExternalResources({
      integrity: "sha256-xxx",
      document,
    });

    expect(elements.map((element) => element.localName)).toEqual(["img"]);
  });
});
