import { describe, expect, it } from "vitest";
import { fetchAndSetDigestSri } from "./fetch-and-set-digest-sri";
import type { DigestSriContent } from "./types";

describe("fetchAndSetDigestSri()", () => {
  it("should set digestSRI when digestSRI is missing", async () => {
    const resource: DigestSriContent = {
      id: "https://example.com/image.svg",
      content:
        "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==",
    };

    await fetchAndSetDigestSri("sha256", resource);

    expect(resource.digestSRI).toBeDefined();
    expect(resource.content).toBeUndefined();
  });

  it("should set digestSRI when digestSRI is missing with content array", async () => {
    const resource: DigestSriContent = {
      id: "https://example.com/image.svg",
      content: [
        "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==",
        "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjx0aXRsZT5tdWx0aXBsZSBjb250ZW50PC90aXRsZT48L3N2Zz4=",
      ],
    };

    await fetchAndSetDigestSri("sha256", resource);

    expect(resource.digestSRI).toBeDefined();
    expect(resource.content).toBeUndefined();
  });

  it("should set digestSRI when content is missing", async () => {
    const resource: DigestSriContent = {
      id: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==",
    };

    await fetchAndSetDigestSri("sha256", resource);

    expect(resource.digestSRI).toBeDefined();
    expect(resource.content).toBeUndefined();
  });

  it("should keep existing digestSRI unchanged", async () => {
    const resource: DigestSriContent = {
      id: "https://example.com/image.svg",
      content:
        "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==",
      digestSRI: "existing-digest",
    };

    await fetchAndSetDigestSri("sha256", resource);

    expect(resource.digestSRI).toBe("existing-digest");
    expect(resource.content).toBeUndefined();
  });
});
