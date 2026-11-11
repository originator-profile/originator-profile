import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "vitest";
import { CaClientError, CaClientErrorCode } from "../errors";
import { parseCas } from "./cas";
import { readCasFile, resolveCasFilePath, writeCasFile } from "./file";

const withTempDir = async (run: (dir: string) => Promise<void>) => {
  const dir = await mkdtemp(join(tmpdir(), "ca-client-cas-"));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

test("writeCasFile: writes JWT as a one-element JSON array with a trailing newline", async () => {
  await withTempDir(async (dir) => {
    const jwt = "test-jwt-token";
    const filePath = join(dir, "cas", "test.cas.json");

    await writeCasFile({ filePath, jwt });

    const written = await readFile(filePath, "utf8");
    expect(written).toBe(`${JSON.stringify([jwt], null, 2)}\n`);
  });
});

test("writeCasFile: creates nested directories from filePath", async () => {
  await withTempDir(async (dir) => {
    const filePath = join(dir, "out", "cas", "nested", "page.cas.json");

    await writeCasFile({ filePath, jwt: "jwt-1" });

    const written = await readFile(filePath, "utf8");
    expect(JSON.parse(written)).toEqual(["jwt-1"]);
  });
});

test("writeCasFile: writes when the parent directory already exists", async () => {
  await withTempDir(async (dir) => {
    const filePath = join(dir, "cas", "b.cas.json");
    await mkdir(join(dir, "cas"), { recursive: true });

    await writeCasFile({ filePath, jwt: "jwt-b" });

    const written = await readFile(filePath, "utf8");
    expect(JSON.parse(written)).toEqual(["jwt-b"]);
  });
});

test("writeCasFile: rejects an empty filePath", async () => {
  await Promise.all(
    ["", "   "].map((filePath) =>
      expect(writeCasFile({ filePath, jwt: "jwt" })).rejects.toMatchObject({
        name: "CaClientError",
        code: CaClientErrorCode.Validation,
        message: "filePath must be a non-empty string",
      }),
    ),
  );
});

test("writeCasFile: rejects an empty jwt", async () => {
  await Promise.all(
    ["", "   "].map((jwt) =>
      expect(
        writeCasFile({ filePath: "cas/a.cas.json", jwt }),
      ).rejects.toMatchObject({
        name: "CaClientError",
        code: CaClientErrorCode.Validation,
        message: "jwt must be a non-empty string",
      }),
    ),
  );
});

test("writeCasFile: replaces an existing file with complete new content", async () => {
  await withTempDir(async (dir) => {
    const filePath = join(dir, "cas", "test.cas.json");

    await writeCasFile({ filePath, jwt: "old-jwt" });
    await writeCasFile({ filePath, jwt: "new-jwt" });

    const written = await readFile(filePath, "utf8");
    expect(written).toBe(`${JSON.stringify(["new-jwt"], null, 2)}\n`);
  });
});

test("writeCasFile: wraps EISDIR when dest is a directory", async () => {
  await withTempDir(async (dir) => {
    const filePath = join(dir, "cas", "test.cas.json");
    await mkdir(filePath, { recursive: true });

    await expect(writeCasFile({ filePath, jwt: "jwt" })).rejects.toMatchObject({
      name: "CaClientError",
      code: CaClientErrorCode.File,
    });
  });
});

test("writeCasFile: wraps filesystem failures as CA_FILE", async () => {
  await withTempDir(async (dir) => {
    const blocker = join(dir, "not-a-dir");
    await writeFile(blocker, "file");

    await expect(
      writeCasFile({
        filePath: join(blocker, "cas", "a.cas.json"),
        jwt: "jwt",
      }),
    ).rejects.toMatchObject({
      name: "CaClientError",
      code: CaClientErrorCode.File,
    });
  });
});

test("resolveCasFilePath: resolves a relative path against process.cwd()", () => {
  expect(resolveCasFilePath("dist/cas/page.cas.json")).toBe(
    resolve(process.cwd(), "dist", "cas", "page.cas.json"),
  );
  expect(resolveCasFilePath("./dist/cas/page.cas.json")).toBe(
    resolve(process.cwd(), "dist", "cas", "page.cas.json"),
  );
});

test("resolveCasFilePath: returns an absolute path unchanged", () => {
  expect(resolveCasFilePath("/abs/cas/page.cas.json")).toBe(
    resolve("/abs/cas/page.cas.json"),
  );
});

test("resolveCasFilePath: rejects an empty path so it is not resolved to cwd", () => {
  for (const filePath of ["", "   "]) {
    expect(() => resolveCasFilePath(filePath)).toThrow(CaClientError);
    expect(() => resolveCasFilePath(filePath)).toThrow(
      "filePath must be a non-empty string",
    );
  }
});

const INVALID_CAS_FORMAT =
  "Invalid CAS file format (expected JSON array with JWT string)";

const encodeJwt = (
  payload: unknown,
  header: Record<string, unknown> = { alg: "ES256", typ: "vc+jwt" },
) =>
  `${Buffer.from(JSON.stringify(header)).toString("base64url")}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.sig`;

test("parseCas: returns every string and { attestation } item", () => {
  const first = "header.payload.signature";
  const second = "header.other.signature";
  expect(parseCas(JSON.stringify([first]))).toEqual([first]);
  expect(
    parseCas(
      JSON.stringify([
        { main: true, attestation: first },
        { attestation: second },
      ]),
    ),
  ).toEqual([{ main: true, attestation: first }, { attestation: second }]);
});

test("parseCas: returns an empty CAS", () => {
  expect(parseCas("[]")).toEqual([]);
});

test("parseCas: rejects a non-array document", () => {
  expect(() => parseCas(JSON.stringify({ notArray: true }))).toThrow(
    CaClientError,
  );
  expect(() => parseCas(JSON.stringify({ notArray: true }))).toThrow(
    INVALID_CAS_FORMAT,
  );
});

test("parseCas: surfaces JSON.parse errors as CA_VALIDATION", () => {
  expect(() => parseCas("{invalid")).toThrow(CaClientError);
  expect(() => parseCas("{invalid")).toThrow(/JSON/i);
});

test("readCasFile: returns every CA with its decoded payload", async () => {
  await withTempDir(async (dir) => {
    const firstPayload = {
      target: [{ type: "TextTargetIntegrity" }],
      iss: "dns:x",
      issuer: "dns:x",
      credentialSubject: { id: "urn:uuid:1" },
    };
    const secondPayload = {
      issuer: "dns:y",
      credentialSubject: { id: "urn:uuid:2" },
    };
    const first = encodeJwt(firstPayload);
    const second = encodeJwt(secondPayload);
    const filePath = join(dir, "ja-JP.about.cas.json");
    await writeFile(
      filePath,
      JSON.stringify([first, { attestation: second, main: true }]),
    );

    const result = await readCasFile(filePath);
    expect(result).toEqual([
      { jwt: first, payload: firstPayload },
      { jwt: second, payload: secondPayload },
    ]);
  });
});

test("readCasFile: reads a file written by writeCasFile", async () => {
  await withTempDir(async (dir) => {
    const payload = { credentialSubject: { id: "urn:uuid:roundtrip" } };
    const jwt = encodeJwt(payload);
    const filePath = join(dir, "cas", "page.cas.json");

    await writeCasFile({ filePath, jwt });
    const result = await readCasFile(filePath);

    expect(result).toEqual([{ jwt, payload }]);
  });
});

test("readCasFile: wraps missing files as CA_FILE", async () => {
  const missing = join(tmpdir(), "missing-cas-file.cas.json");
  await expect(readCasFile(missing)).rejects.toMatchObject({
    name: "CaClientError",
    code: CaClientErrorCode.File,
    message: expect.stringMatching(
      `^Failed to read CAS file ${resolve(missing)}:`,
    ),
  });
});

test("readCasFile: rejects an empty filePath as CA_VALIDATION", async () => {
  await expect(readCasFile("   ")).rejects.toMatchObject({
    name: "CaClientError",
    code: CaClientErrorCode.Validation,
    message: "filePath must be a non-empty string",
  });
});

test("readCasFile: rejects an invalid JWT as CA_VALIDATION", async () => {
  await withTempDir(async (dir) => {
    const filePath = join(dir, "bad.cas.json");
    await writeFile(filePath, JSON.stringify(["not-a-jwt"]));

    await expect(readCasFile(filePath)).rejects.toMatchObject({
      name: "CaClientError",
      code: CaClientErrorCode.Validation,
      message: "Invalid JWT: expected 3 parts, got 1",
    });
  });
});
