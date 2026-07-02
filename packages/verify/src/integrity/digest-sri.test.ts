import {
  type MockInstance,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import { createIntegrityMetadata } from "websri";
import { verifyDigestSri, verifyImageDigestSri } from "./digest-sri";

async function fetcher(): Promise<Response> {
  return new Response("Hello, World!");
}

const integrityMetadata = await createIntegrityMetadata(
  "sha256",
  await new Response("Hello, World!").arrayBuffer(),
);

const content = {
  id: "https://example.org/foo/bar",
  digestSRI: integrityMetadata.toString(),
};

test("Verify Digest SRI successfully", async () => {
  expect(await verifyDigestSri(content, fetcher)).toBe(true);
});

test("Digest SRI mismatch", async () => {
  const mismatch = await createIntegrityMetadata(
    "sha256",
    await new Response("mismatch").arrayBuffer(),
  );

  const mismatchDigestSriContent = {
    ...content,
    digestSRI: mismatch.toString(),
  };

  expect(await verifyDigestSri(mismatchDigestSriContent, fetcher)).toBe(false);
});

test("Unsupported algorithm", async () => {
  const unsupportedAlgContent = {
    id: "https://example.org/foo/bar",
    digestSRI: "md5-ZajifYh5KDgxtmS9i38K1A==",
  };

  expect(await verifyDigestSri(unsupportedAlgContent, fetcher)).toBe(false);
});

test("Fetch failure returns false and logs error", async () => {
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  const error = new TypeError("network error");

  async function failure(): Promise<Response> {
    throw error;
  }

  expect(await verifyDigestSri(content, failure)).toBe(false);
  expect(errorSpy).toHaveBeenCalledWith(
    "Failed to access content for digestSRI verification:",
    error,
  );

  errorSpy.mockRestore();
});

test("Multiple hash algorithms - verify with strongest", async () => {
  const sha384Metadata = await createIntegrityMetadata(
    "sha384",
    await new Response("Hello, World!").arrayBuffer(),
  );
  const sha256Metadata = await createIntegrityMetadata(
    "sha256",
    await new Response("Hello, World!").arrayBuffer(),
  );

  const multiAlgContent = {
    id: "https://example.org/foo/bar",
    digestSRI: `${sha256Metadata.toString()} ${sha384Metadata.toString()}`,
  };

  expect(await verifyDigestSri(multiAlgContent, fetcher)).toBe(true);
});

test("Multiple hash algorithms - one mismatch", async () => {
  const sha384Metadata = await createIntegrityMetadata(
    "sha384",
    await new Response("Hello, World!").arrayBuffer(),
  );
  const wrongSha256 = await createIntegrityMetadata(
    "sha256",
    await new Response("wrong content").arrayBuffer(),
  );

  const multiAlgContent = {
    id: "https://example.org/foo/bar",
    digestSRI: `${wrongSha256.toString()} ${sha384Metadata.toString()}`,
  };

  expect(await verifyDigestSri(multiAlgContent, fetcher)).toBe(true);
});

test("Empty algorithm list", async () => {
  const emptyAlgContent = {
    id: "https://example.org/foo/bar",
    digestSRI: "",
  };

  expect(await verifyDigestSri(emptyAlgContent, fetcher)).toBe(false);
});

test("Invalid integrity metadata format", async () => {
  const invalidContent = {
    id: "https://example.org/foo/bar",
    digestSRI: "invalid-format-without-dash",
  };

  expect(await verifyDigestSri(invalidContent, fetcher)).toBe(false);
});

describe("verifyImageDigestSri", () => {
  let warnSpy: MockInstance;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  test("digestSRI 検証に成功した場合、warn を出さない", async () => {
    await verifyImageDigestSri(
      { id: content.id, digestSRI: content.digestSRI },
      { fetcher },
    );

    expect(warnSpy).not.toHaveBeenCalled();
  });

  test("digestSRI 検証に失敗した場合、warn を出す", async () => {
    await verifyImageDigestSri(
      { id: content.id, digestSRI: content.digestSRI },
      { fetcher: async () => new Response("wrong content") },
    );

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("digestSRI verification failed"),
    );
  });

  test("digestSRI が存在しない場合、warn を出す", async () => {
    await verifyImageDigestSri(
      { id: "https://example.org/image.png" },
      { fetcher },
    );

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("digestSRI is missing"),
    );
  });

  test("undefined の場合、何もしない", async () => {
    await verifyImageDigestSri(undefined, { fetcher });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test("warn ハンドラーを指定した場合、console.warn の代わりに警告を受け取る", async () => {
    const warnings: string[] = [];
    await verifyImageDigestSri(
      { id: "https://example.org/image.png" },
      { fetcher, warn: (message) => warnings.push(message) },
    );

    expect(warnings).toEqual([expect.stringContaining("digestSRI is missing")]);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
