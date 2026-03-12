import { describe, expect, it } from "vitest";
import { fetchAndSetDigestSri } from "./fetch-and-set-digest-sri";

describe("fetchAndSetDigestSri()", () => {
  it("should set digestSRI when digestSRI is missing", async () => {
    const resource = {
      id: "https://example.com/image.svg",
      content:
        "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==",
    };

    const result = await fetchAndSetDigestSri("sha256", resource);

    expect(result).toHaveProperty("digestSRI");
    expect(result).not.toHaveProperty("content");
  });

  it("should set digestSRI when digestSRI is missing with content array", async () => {
    const resource = {
      id: "https://example.com/image.svg",
      content: [
        "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==",
        "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjx0aXRsZT5tdWx0aXBsZSBjb250ZW50PC90aXRsZT48L3N2Zz4=",
      ],
    };

    const result = await fetchAndSetDigestSri("sha256", resource);

    expect(result).toHaveProperty("digestSRI");
    expect(result).not.toHaveProperty("content");
  });

  it("should set digestSRI when content is missing", async () => {
    const resource = {
      id: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==",
    };

    const result = await fetchAndSetDigestSri("sha256", resource);

    expect(result).toHaveProperty("digestSRI");
    expect(result).not.toHaveProperty("content");
  });

  it("should keep existing digestSRI unchanged", async () => {
    const resource = {
      id: "https://example.com/image.svg",
      content:
        "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==",
      digestSRI: "existing-digest",
    };

    const result = await fetchAndSetDigestSri("sha256", resource);

    expect(result).toHaveProperty("digestSRI", "existing-digest");
    expect(result).not.toHaveProperty("content");
  });
});
