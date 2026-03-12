import { expect, test } from "vitest";
import { createIntegrityMetadata, type HashAlgorithm } from "websri";
import { createDigestSri } from "./digest-sri";
import type { DigestSriResult } from "./types";

async function fetcher(): Promise<Response> {
  return new Response("Hello, World!");
}

const resource = {
  id: "https://example.org/foo/bar",
};

test("Create Digest SRI", async () => {
  const integrityMetadata = await createIntegrityMetadata(
    "sha256",
    await new Response("Hello, World!").arrayBuffer(),
  );

  expect(await createDigestSri("sha256", resource, fetcher)).toEqual({
    id: "https://example.org/foo/bar",
    digestSRI: integrityMetadata.toString(),
  } satisfies DigestSriResult);
});

test("Unsupported algorithm", async () => {
  expect(
    await createDigestSri("md5" as HashAlgorithm, resource, fetcher),
  ).toEqual({ id: "https://example.org/foo/bar" });
});

test("Fetch failure", async () => {
  async function failure(): Promise<Response> {
    throw new TypeError("failure");
  }

  await expect(
    createDigestSri("sha256", resource, failure),
  ).rejects.toThrowError();
});

test("Multiple content URLs - hashes are joined with space", async () => {
  const resourceWithMultipleContent = {
    id: "https://example.org/foo/bar",
    content: ["https://example.org/content1", "https://example.org/content2"],
  };

  async function multiFetcher(input: RequestInfo | URL): Promise<Response> {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;

    if (url.endsWith("/content1")) return new Response("Content 1");
    if (url.endsWith("/content2")) return new Response("Content 2");
    return new Response("Default");
  }

  const meta1 = await createIntegrityMetadata(
    "sha256",
    await new Response("Content 1").arrayBuffer(),
  );
  const meta2 = await createIntegrityMetadata(
    "sha256",
    await new Response("Content 2").arrayBuffer(),
  );

  const result = await createDigestSri(
    "sha256",
    resourceWithMultipleContent,
    multiFetcher,
  );

  expect(result).toEqual({
    id: "https://example.org/foo/bar",
    digestSRI: `${meta1.toString()} ${meta2.toString()}`,
  } satisfies DigestSriResult);
});
