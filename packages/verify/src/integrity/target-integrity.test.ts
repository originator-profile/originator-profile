import { Target } from "@originator-profile/model";
import { createIntegrity } from "@originator-profile/sign";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createIntegrityMetadata,
  createIntegrityMetadataSet,
  IntegrityMetadataSet,
} from "websri";
import { IntegrityFetchFailed, IntegrityVerificationFailed } from "./error";
import { verifyIntegrity } from "./target-integrity";
import { IntegrityVerifyResult } from "./types";

describe("verifyIntegrity()", () => {
  beforeEach(() => {
    document.body.textContent = "ok";
  });

  it("should return true when integrity matches", async () => {
    const content = await createIntegrity("sha256", {
      type: "TextTargetIntegrity",
      cssSelector: "body",
    });

    const fetchResult = await verifyIntegrity(content as Target);
    expect(fetchResult instanceof Error).toBe(false);
    const verifyResult = fetchResult as IntegrityVerifyResult;
    expect(verifyResult.valid).toBe(true);
  });

  it("should return false if integrity algorithm is unsupported", async () => {
    const content: Target = {
      type: "TextTargetIntegrity",
      cssSelector: "body",
      integrity: "md5-REvLOj/Pg4kpbElGfyfh1g==",
    };

    const fetchResult = await verifyIntegrity(content);
    expect(fetchResult instanceof Error).toBe(false);
    const verifyResult = fetchResult as IntegrityVerifyResult;
    expect(verifyResult.valid).toBe(false);
  });

  it("should return false if no elements are selected", async () => {
    const integrityMetadata = await createIntegrityMetadata(
      "sha256",
      await new Response("ok").arrayBuffer(),
    );

    const content: Target = {
      type: "TextTargetIntegrity",
      cssSelector: "non-existent-element",
      integrity: integrityMetadata.toString(),
    };

    const fetchResult = await verifyIntegrity(content);
    expect(fetchResult instanceof Error).toBe(false);
    const verifyResult = fetchResult as IntegrityVerifyResult;
    expect(verifyResult.valid).toBe(false);
  });

  it("should verify ExternalResourceTargetIntegrity using src attribute", async () => {
    const svgData = await fetch(
      "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==",
    ).then((res) => res.arrayBuffer());
    const integrityMetadata = await createIntegrityMetadata("sha256", svgData);

    document.body.innerHTML = `\
<img integrity="${integrityMetadata.toString()}" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==" />
`;

    const content: Target = {
      type: "ExternalResourceTargetIntegrity",
      integrity: integrityMetadata.toString(),
    };

    const fetchResult = await verifyIntegrity(content);
    expect(fetchResult instanceof Error).toBe(false);
    const verifyResult = fetchResult as IntegrityVerifyResult;
    expect(verifyResult.valid).toBe(true);
  });

  it("should verify ExternalResourceTargetIntegrity using currentSrc when available", async () => {
    const integrityMetadata = await createIntegrityMetadata(
      "sha256",
      await new Response("currentSrcContent").arrayBuffer(),
    );

    document.body.innerHTML = `\
<video controls integrity="${integrityMetadata.toString()}">
  <source src="data:text/plain,currentSrcContent" />
  <source src="data:text/plain,otherSourceContent" />
</video>
`;

    const content: Target = {
      type: "ExternalResourceTargetIntegrity",
      integrity: integrityMetadata.toString(),
    };

    const fetchResult = await verifyIntegrity(content);
    expect(fetchResult instanceof Error).toBe(false);
    const verifyResult = fetchResult as IntegrityVerifyResult;
    expect(verifyResult.valid).toBe(true);
  });

  it("should verify only currentSrc when multiple sources exist", async () => {
    const integrityMetadataSet = new IntegrityMetadataSet(
      await Promise.all(
        ["videoSource1", "videoSource2", "videoSource3"].map(
          async (sourceData) => {
            return await createIntegrityMetadata(
              "sha256",
              await new Response(sourceData).arrayBuffer(),
            );
          },
        ),
      ),
    );

    document.body.innerHTML = `\
<video controls integrity="${integrityMetadataSet.toString()}">
  <source src="data:text/plain,videoSource1" type="video/mp4" />
  <source src="data:text/plain,videoSource2" type="video/webm" />
  <source src="data:text/plain,videoSource3" type="video/ogg" />
</video>
`;

    const content: Target = {
      type: "ExternalResourceTargetIntegrity",
      integrity: integrityMetadataSet.toString(),
    };

    const fetchResult = await verifyIntegrity(content);
    expect(fetchResult instanceof Error).toBe(false);
    const verifyResult = fetchResult as IntegrityVerifyResult;
    expect(verifyResult.valid).toBe(true);
  });

  it("should verify with multiple overlapping hash algorithms", async () => {
    const meta = await createIntegrityMetadataSet(
      ["sha256", "sha384"],
      await new Response("testContent").arrayBuffer(),
    );
    const other = await createIntegrityMetadataSet(
      ["sha256", "sha384"],
      await new Response("other").arrayBuffer(),
    );

    const overlappingIntegrity = `${meta.toString()} ${other.toString()}`;
    const integritySet = new IntegrityMetadataSet(overlappingIntegrity);
    expect(integritySet.size).toBe(4);

    document.body.innerHTML = `\
<img integrity="${overlappingIntegrity}" src="data:text/plain,testContent" />
`;

    const content: Target = {
      type: "ExternalResourceTargetIntegrity",
      integrity: overlappingIntegrity,
    };

    const fetchResult = await verifyIntegrity(content);
    expect(fetchResult instanceof Error).toBe(false);
    const verifyResult = fetchResult as IntegrityVerifyResult;
    expect(verifyResult.valid).toBe(true);
  });

  it("should return FetchIntegrityFailed when fetch fails", async () => {
    const content: Target = {
      type: "ExternalResourceTargetIntegrity",
      integrity: "sha256-test",
    };

    document.body.innerHTML =
      '<img integrity="sha256-test" src="https://example.com/image.png" />';

    const mockFetcher = () => Promise.reject(new Error("Network error"));
    const result = await verifyIntegrity(content, document, mockFetcher);

    expect(result instanceof Error).toBe(true);
    expect(result).toBeInstanceOf(IntegrityFetchFailed);
  });

  describe("cssSelector for ExternalResourceTargetIntegrity", () => {
    const sriOf = async (content: string) =>
      (
        await createIntegrityMetadata(
          "sha256",
          await new Response(content).arrayBuffer(),
        )
      ).toString();

    it("should verify the element matching the CSS selector without an integrity attribute", async () => {
      const integrity = await sriOf("ok");

      document.body.innerHTML = `\
<img class="hero" src="data:text/plain,ok" />
`;

      const fetchResult = await verifyIntegrity({
        type: "ExternalResourceTargetIntegrity",
        cssSelector: ".hero",
        integrity,
      });

      expect(fetchResult instanceof Error).toBe(false);
      expect((fetchResult as IntegrityVerifyResult).valid).toBe(true);
    });

    it("should prefer the CSS selector over the integrity attribute", async () => {
      const integrity = await sriOf("ok");

      document.body.innerHTML = `\
<img class="hero" src="data:text/plain,ok" />
<img integrity="${integrity}" src="data:text/plain,ng" />
`;

      const fetchResult = await verifyIntegrity({
        type: "ExternalResourceTargetIntegrity",
        cssSelector: ".hero",
        integrity,
      });

      expect(fetchResult instanceof Error).toBe(false);
      expect((fetchResult as IntegrityVerifyResult).valid).toBe(true);
    });

    it("should return true when every element matching the CSS selector matches the integrity", async () => {
      const integrity = await sriOf("ok");

      document.body.innerHTML = `\
<img class="logo" src="data:text/plain,ok" />
<img class="logo" src="data:text/plain,ok" />
`;

      const fetchResult = await verifyIntegrity({
        type: "ExternalResourceTargetIntegrity",
        cssSelector: ".logo",
        integrity,
      });

      expect(fetchResult instanceof Error).toBe(false);
      expect((fetchResult as IntegrityVerifyResult).valid).toBe(true);
    });

    it("should return false when any element matching the CSS selector does not match the integrity", async () => {
      const integrity = await sriOf("ok");

      document.body.innerHTML = `\
<img class="logo" src="data:text/plain,ok" />
<img class="logo" src="data:text/plain,ng" />
`;

      const fetchResult = await verifyIntegrity({
        type: "ExternalResourceTargetIntegrity",
        cssSelector: ".logo",
        integrity,
      });

      expect(fetchResult instanceof Error).toBe(false);
      const verifyResult = fetchResult as IntegrityVerifyResult;
      expect(verifyResult.valid).toBe(false);
      expect(verifyResult.failedIntegrities).toEqual([await sriOf("ng")]);
    });

    it("should return false when any element matching the integrity attribute does not match the integrity", async () => {
      const integrity = await sriOf("ok");

      document.body.innerHTML = `\
<img integrity="${integrity}" src="data:text/plain,ok" />
<img integrity="${integrity}" src="data:text/plain,ng" />
`;

      const fetchResult = await verifyIntegrity({
        type: "ExternalResourceTargetIntegrity",
        integrity,
      });

      expect(fetchResult instanceof Error).toBe(false);
      const verifyResult = fetchResult as IntegrityVerifyResult;
      expect(verifyResult.valid).toBe(false);
      expect(verifyResult.failedIntegrities).toEqual([await sriOf("ng")]);
    });

    it("should return false if no elements match the CSS selector", async () => {
      const integrity = await sriOf("ok");

      document.body.innerHTML = `\
<img integrity="${integrity}" src="data:text/plain,ok" />
`;

      const fetchResult = await verifyIntegrity({
        type: "ExternalResourceTargetIntegrity",
        cssSelector: ".non-existent",
        integrity,
      });

      expect(fetchResult instanceof Error).toBe(false);
      const verifyResult = fetchResult as IntegrityVerifyResult;
      expect(verifyResult.valid).toBe(false);
      expect(verifyResult.failedIntegrities).toEqual([]);
    });

    it("should return IntegrityVerificationFailed if the CSS selector has a syntax error", async () => {
      const fetchResult = await verifyIntegrity({
        type: "ExternalResourceTargetIntegrity",
        cssSelector: "[",
        integrity: await sriOf("ok"),
      });

      expect(fetchResult).toBeInstanceOf(IntegrityVerificationFailed);
    });
  });

  describe("target elements for ExternalResourceTargetIntegrity", () => {
    const sriOf = async (content: string) =>
      (
        await createIntegrityMetadata(
          "sha256",
          await new Response(content).arrayBuffer(),
        )
      ).toString();

    it("should return false if only elements that are not target elements match", async () => {
      const integrity = await sriOf("ok");

      document.body.innerHTML = `\
<iframe integrity="${integrity}" src="data:text/plain,ok"></iframe>
`;

      const fetchResult = await verifyIntegrity({
        type: "ExternalResourceTargetIntegrity",
        integrity,
      });

      expect(fetchResult instanceof Error).toBe(false);
      const verifyResult = fetchResult as IntegrityVerifyResult;
      expect(verifyResult.valid).toBe(false);
      expect(verifyResult.failedIntegrities).toEqual([]);
    });

    it("should verify only target elements when other elements also match", async () => {
      const integrity = await sriOf("ok");

      document.body.innerHTML = `\
<img class="hero" src="data:text/plain,ok" />
<iframe class="hero" src="data:text/plain,other"></iframe>
<div class="hero"></div>
`;

      const fetchResult = await verifyIntegrity({
        type: "ExternalResourceTargetIntegrity",
        cssSelector: ".hero",
        integrity,
      });

      expect(fetchResult instanceof Error).toBe(false);
      const verifyResult = fetchResult as IntegrityVerifyResult;
      expect(verifyResult.valid).toBe(true);
    });

    it("should verify an unselected source element in a video element", async () => {
      const integrity = await sriOf("unselected");

      document.body.innerHTML = `\
<video>
  <source src="data:text/plain,selected" />
  <source id="unselected" src="data:text/plain,unselected" />
</video>
`;

      const fetchResult = await verifyIntegrity({
        type: "ExternalResourceTargetIntegrity",
        cssSelector: "#unselected",
        integrity,
      });

      expect(fetchResult instanceof Error).toBe(false);
      const verifyResult = fetchResult as IntegrityVerifyResult;
      expect(verifyResult.valid).toBe(true);
    });

    it("should verify all srcset candidates of a source element in a picture element", async () => {
      const integrity = `${await sriOf("small")} ${await sriOf("large")}`;

      document.body.innerHTML = `\
<picture>
  <source id="picture-source" srcset="data:text/plain,small 1x, data:text/plain,large 2x" />
  <img src="data:text/plain,image" />
</picture>
`;

      const fetchResult = await verifyIntegrity({
        type: "ExternalResourceTargetIntegrity",
        cssSelector: "#picture-source",
        integrity,
      });

      expect(fetchResult instanceof Error).toBe(false);
      const verifyResult = fetchResult as IntegrityVerifyResult;
      expect(verifyResult.valid).toBe(true);
    });

    it("should return false if any srcset candidate of a source element in a picture element does not match", async () => {
      const integrity = await sriOf("small");

      document.body.innerHTML = `\
<picture>
  <source id="picture-source" srcset="data:text/plain,small 1x, data:text/plain,large 2x" />
  <img src="data:text/plain,image" />
</picture>
`;

      const fetchResult = await verifyIntegrity({
        type: "ExternalResourceTargetIntegrity",
        cssSelector: "#picture-source",
        integrity,
      });

      expect(fetchResult instanceof Error).toBe(false);
      const verifyResult = fetchResult as IntegrityVerifyResult;
      expect(verifyResult.valid).toBe(false);
      expect(verifyResult.failedIntegrities).toEqual([await sriOf("large")]);
    });
  });
});
