import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "vitest";
import { CaClientError, CaClientErrorCode } from "../errors";
import { deleteCasFiles, resolveCasFilePath, writeCasFile } from "./file";

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

test("deleteCasFiles: deletes existing CAS files", async () => {
  await withTempDir(async (dir) => {
    const keep = join(dir, "cas", "keep.cas.json");
    const drop = join(dir, "cas", "drop.cas.json");

    await writeCasFile({ filePath: keep, jwt: "keep" });
    await writeCasFile({ filePath: drop, jwt: "drop" });

    await deleteCasFiles([drop]);

    const kept = await readFile(keep, "utf8");
    expect(JSON.parse(kept)).toEqual(["keep"]);
    await expect(readFile(drop, "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});

test("deleteCasFiles: skips missing files", async () => {
  await withTempDir(async (dir) => {
    await expect(
      deleteCasFiles([join(dir, "cas", "missing.cas.json")]),
    ).resolves.toBeUndefined();
  });
});

test("deleteCasFiles: does nothing for an empty list", async () => {
  await expect(deleteCasFiles([])).resolves.toBeUndefined();
});

test("deleteCasFiles: rejects an empty filePath before deleting any files", async () => {
  await withTempDir(async (dir) => {
    const keep = join(dir, "cas", "keep.cas.json");
    await writeCasFile({ filePath: keep, jwt: "keep" });

    await expect(deleteCasFiles([keep, ""])).rejects.toMatchObject({
      name: "CaClientError",
      code: CaClientErrorCode.Validation,
      message: "filePath must be a non-empty string",
    });
    await expect(deleteCasFiles([keep, "   "])).rejects.toMatchObject({
      name: "CaClientError",
      code: CaClientErrorCode.Validation,
      message: "filePath must be a non-empty string",
    });

    const kept = await readFile(keep, "utf8");
    expect(JSON.parse(kept)).toEqual(["keep"]);
  });
});

test("deleteCasFiles: deletes multiple CAS files", async () => {
  await withTempDir(async (dir) => {
    const filePaths = [
      join(dir, "cas", "one.cas.json"),
      join(dir, "cas", "two.cas.json"),
    ];
    await Promise.all(
      filePaths.map((filePath) => writeCasFile({ filePath, jwt: filePath })),
    );

    await deleteCasFiles(filePaths);

    await Promise.all(
      filePaths.map((filePath) =>
        expect(readFile(filePath, "utf8")).rejects.toMatchObject({
          code: "ENOENT",
        }),
      ),
    );
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
