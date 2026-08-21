import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "vitest";
import { CaClientError, CaClientErrorCode } from "../errors";
import { deleteCasFiles, resolveCasDir, writeCasFile } from "./file";

const withTempDir = async (run: (dir: string) => Promise<void>) => {
  const dir = await mkdtemp(join(tmpdir(), "ca-client-cas-store-"));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

test("writeCasFile: writes JWT as a one-element JSON array with a trailing newline", async () => {
  await withTempDir(async (dir) => {
    const jwt = "test-jwt-token";

    await writeCasFile({
      fileName: "test.cas.json",
      jwt,
      outputDir: "cas",
      baseDir: dir,
    });

    const written = await readFile(join(dir, "cas", "test.cas.json"), "utf8");
    expect(written).toBe(`${JSON.stringify([jwt], null, 2)}\n`);
  });
});

test("writeCasFile: creates nested directories from outputDir and fileName", async () => {
  await withTempDir(async (dir) => {
    await writeCasFile({
      fileName: "nested/page.cas.json",
      jwt: "jwt-1",
      outputDir: "out/cas",
      baseDir: dir,
    });

    const written = await readFile(
      join(dir, "out", "cas", "nested", "page.cas.json"),
      "utf8",
    );
    expect(JSON.parse(written)).toEqual(["jwt-1"]);
  });
});

test("writeCasFile: resolves relative outputDir against the baseDir option", async () => {
  await withTempDir(async (dir) => {
    await writeCasFile({
      fileName: "a.cas.json",
      jwt: "jwt-a",
      outputDir: "relative/cas",
      baseDir: dir,
    });

    const written = await readFile(
      join(dir, "relative", "cas", "a.cas.json"),
      "utf8",
    );
    expect(JSON.parse(written)).toEqual(["jwt-a"]);
  });
});

test("writeCasFile: uses an absolute outputDir as-is", async () => {
  await withTempDir(async (dir) => {
    const outputDir = join(dir, "absolute", "cas");

    await writeCasFile({
      fileName: "b.cas.json",
      jwt: "jwt-b",
      outputDir,
      baseDir: "/unused",
    });

    const written = await readFile(join(outputDir, "b.cas.json"), "utf8");
    expect(JSON.parse(written)).toEqual(["jwt-b"]);
  });
});

test("writeCasFile: rejects an empty outputDir", async () => {
  await expect(
    writeCasFile({ fileName: "a.cas.json", jwt: "jwt", outputDir: "" }),
  ).rejects.toMatchObject({
    name: "CaClientError",
    code: CaClientErrorCode.Validation,
    message: "outputDir must be a non-empty string",
  });
});

test("writeCasFile: rejects an empty fileName", async () => {
  await expect(
    writeCasFile({ fileName: "", jwt: "jwt", outputDir: "cas" }),
  ).rejects.toMatchObject({
    name: "CaClientError",
    code: CaClientErrorCode.Validation,
    message: "fileName must be a non-empty string",
  });
});

test("writeCasFile: rejects an empty jwt", async () => {
  await expect(
    writeCasFile({ fileName: "a.cas.json", jwt: "", outputDir: "cas" }),
  ).rejects.toMatchObject({
    name: "CaClientError",
    code: CaClientErrorCode.Validation,
    message: "jwt must be a non-empty string",
  });
});

test("writeCasFile: wraps filesystem failures as CA_FILE", async () => {
  await withTempDir(async (dir) => {
    const blocker = join(dir, "not-a-dir");
    await writeFile(blocker, "file");

    await expect(
      writeCasFile({
        fileName: "a.cas.json",
        jwt: "jwt",
        outputDir: join(blocker, "cas"),
      }),
    ).rejects.toMatchObject({
      name: "CaClientError",
      code: CaClientErrorCode.File,
    });
  });
});

test("deleteCasFiles: deletes existing CAS files", async () => {
  await withTempDir(async (dir) => {
    await writeCasFile({
      fileName: "keep.cas.json",
      jwt: "keep",
      outputDir: "cas",
      baseDir: dir,
    });
    await writeCasFile({
      fileName: "drop.cas.json",
      jwt: "drop",
      outputDir: "cas",
      baseDir: dir,
    });

    await deleteCasFiles(["drop.cas.json"], { outputDir: "cas", baseDir: dir });

    const kept = await readFile(join(dir, "cas", "keep.cas.json"), "utf8");
    expect(JSON.parse(kept)).toEqual(["keep"]);
    await expect(
      readFile(join(dir, "cas", "drop.cas.json"), "utf8"),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });
});

test("deleteCasFiles: skips missing files", async () => {
  await withTempDir(async (dir) => {
    await mkdir(join(dir, "cas"), { recursive: true });

    await expect(
      deleteCasFiles(["missing.cas.json"], { outputDir: "cas", baseDir: dir }),
    ).resolves.toBeUndefined();
  });
});

test("deleteCasFiles: does nothing for an empty list", async () => {
  await expect(deleteCasFiles([], { outputDir: "" })).resolves.toBeUndefined();
});

test("deleteCasFiles: deletes multiple CAS files", async () => {
  await withTempDir(async (dir) => {
    const names = ["one.cas.json", "two.cas.json"];
    await Promise.all(
      names.map((fileName) =>
        writeCasFile({
          fileName,
          jwt: fileName,
          outputDir: "cas",
          baseDir: dir,
        }),
      ),
    );

    await deleteCasFiles(names, { outputDir: "cas", baseDir: dir });

    await Promise.all(
      names.map((name) =>
        expect(readFile(join(dir, "cas", name), "utf8")).rejects.toMatchObject({
          code: "ENOENT",
        }),
      ),
    );
  });
});

test("resolveCasDir: resolves a relative path against baseDir", () => {
  const dir = resolveCasDir({ outputDir: "public/cas", baseDir: "/workspace" });
  expect(dir).toBe(resolve("/workspace", "public", "cas"));
});

test("resolveCasDir: defaults to process.cwd() for relative paths", () => {
  expect(resolveCasDir({ outputDir: "public/cas" })).toBe(
    resolve(process.cwd(), "public", "cas"),
  );
});

test("resolveCasDir: returns an absolute path unchanged", () => {
  expect(resolveCasDir({ outputDir: "/abs/cas", baseDir: "/workspace" })).toBe(
    resolve("/abs/cas"),
  );
});

test("resolveCasDir: rejects an empty path so it is not resolved to the root", () => {
  expect(() => resolveCasDir({ outputDir: "" })).toThrow(CaClientError);
  expect(() => resolveCasDir({ outputDir: "" })).toThrow(
    "outputDir must be a non-empty string",
  );
});
