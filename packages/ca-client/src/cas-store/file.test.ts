import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "vitest";
import { CaClientError, CaClientErrorCode } from "../errors";
import {
  casFilePath,
  deleteCasFiles,
  resolveCasDir,
  writeCasFile,
} from "./file";

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
    const outputDir = join(dir, "cas");

    await writeCasFile({
      fileName: "test.cas.json",
      jwt,
      outputDir,
    });

    const written = await readFile(join(outputDir, "test.cas.json"), "utf8");
    expect(written).toBe(`${JSON.stringify([jwt], null, 2)}\n`);
  });
});

test("writeCasFile: creates nested directories from outputDir and fileName", async () => {
  await withTempDir(async (dir) => {
    const outputDir = join(dir, "out", "cas");

    await writeCasFile({
      fileName: "nested/page.cas.json",
      jwt: "jwt-1",
      outputDir,
    });

    const written = await readFile(
      join(outputDir, "nested", "page.cas.json"),
      "utf8",
    );
    expect(JSON.parse(written)).toEqual(["jwt-1"]);
  });
});

test("writeCasFile: writes when outputDir already exists", async () => {
  await withTempDir(async (dir) => {
    const outputDir = join(dir, "cas");
    await mkdir(outputDir, { recursive: true });

    await writeCasFile({
      fileName: "b.cas.json",
      jwt: "jwt-b",
      outputDir,
    });

    const written = await readFile(join(outputDir, "b.cas.json"), "utf8");
    expect(JSON.parse(written)).toEqual(["jwt-b"]);
  });
});

test("writeCasFile: rejects an empty outputDir", async () => {
  for (const outputDir of ["", "   "]) {
    await expect(
      writeCasFile({ fileName: "a.cas.json", jwt: "jwt", outputDir }),
    ).rejects.toMatchObject({
      name: "CaClientError",
      code: CaClientErrorCode.Validation,
      message: "outputDir must be a non-empty string",
    });
  }
});

test("writeCasFile: rejects an empty fileName", async () => {
  for (const fileName of ["", "   "]) {
    await expect(
      writeCasFile({ fileName, jwt: "jwt", outputDir: "cas" }),
    ).rejects.toMatchObject({
      name: "CaClientError",
      code: CaClientErrorCode.Validation,
      message: "fileName must be a non-empty string",
    });
  }
});

test("writeCasFile: rejects a fileName that escapes outputDir", async () => {
  await withTempDir(async (dir) => {
    await expect(
      writeCasFile({
        fileName: "../outside.cas.json",
        jwt: "jwt",
        outputDir: join(dir, "cas"),
      }),
    ).rejects.toMatchObject({
      name: "CaClientError",
      code: CaClientErrorCode.Validation,
      message: "fileName must stay inside outputDir",
    });

    await expect(
      readFile(join(dir, "outside.cas.json"), "utf8"),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });
});

test("writeCasFile: rejects an empty jwt", async () => {
  for (const jwt of ["", "   "]) {
    await expect(
      writeCasFile({ fileName: "a.cas.json", jwt, outputDir: "cas" }),
    ).rejects.toMatchObject({
      name: "CaClientError",
      code: CaClientErrorCode.Validation,
      message: "jwt must be a non-empty string",
    });
  }
});

test("writeCasFile: replaces an existing file with complete new content", async () => {
  await withTempDir(async (dir) => {
    const outputDir = join(dir, "cas");

    await writeCasFile({
      fileName: "test.cas.json",
      jwt: "old-jwt",
      outputDir,
    });
    await writeCasFile({
      fileName: "test.cas.json",
      jwt: "new-jwt",
      outputDir,
    });

    const written = await readFile(join(outputDir, "test.cas.json"), "utf8");
    expect(written).toBe(`${JSON.stringify(["new-jwt"], null, 2)}\n`);
  });
});

test("writeCasFile: wraps EISDIR when dest is a directory", async () => {
  await withTempDir(async (dir) => {
    const outputDir = join(dir, "cas");
    await mkdir(join(outputDir, "test.cas.json"), { recursive: true });

    await expect(
      writeCasFile({
        fileName: "test.cas.json",
        jwt: "jwt",
        outputDir,
      }),
    ).rejects.toMatchObject({
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
    const outputDir = join(dir, "cas");

    await writeCasFile({
      fileName: "keep.cas.json",
      jwt: "keep",
      outputDir,
    });
    await writeCasFile({
      fileName: "drop.cas.json",
      jwt: "drop",
      outputDir,
    });

    await deleteCasFiles(["drop.cas.json"], outputDir);

    const kept = await readFile(join(outputDir, "keep.cas.json"), "utf8");
    expect(JSON.parse(kept)).toEqual(["keep"]);
    await expect(
      readFile(join(outputDir, "drop.cas.json"), "utf8"),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });
});

test("deleteCasFiles: skips missing files", async () => {
  await withTempDir(async (dir) => {
    const outputDir = join(dir, "cas");
    await mkdir(outputDir, { recursive: true });

    await expect(
      deleteCasFiles(["missing.cas.json"], outputDir),
    ).resolves.toBeUndefined();
  });
});

test("deleteCasFiles: does nothing for an empty list", async () => {
  await withTempDir(async (dir) => {
    await expect(deleteCasFiles([], join(dir, "cas"))).resolves.toBeUndefined();
  });
});

test("deleteCasFiles: rejects an empty outputDir even for an empty list", async () => {
  for (const outputDir of ["", "   "]) {
    await expect(
      deleteCasFiles(["a.cas.json"], outputDir),
    ).rejects.toMatchObject({
      name: "CaClientError",
      code: CaClientErrorCode.Validation,
      message: "outputDir must be a non-empty string",
    });
    await expect(deleteCasFiles([], outputDir)).rejects.toMatchObject({
      name: "CaClientError",
      code: CaClientErrorCode.Validation,
      message: "outputDir must be a non-empty string",
    });
  }
});

test("deleteCasFiles: rejects a fileName that escapes outputDir before deleting any files", async () => {
  await withTempDir(async (dir) => {
    const outputDir = join(dir, "cas");

    await writeCasFile({
      fileName: "keep.cas.json",
      jwt: "keep",
      outputDir,
    });
    const outside = join(dir, "outside.cas.json");
    await writeFile(outside, "secret");

    await expect(
      deleteCasFiles(["keep.cas.json", "../outside.cas.json"], outputDir),
    ).rejects.toMatchObject({
      name: "CaClientError",
      code: CaClientErrorCode.Validation,
      message: "fileName must stay inside outputDir",
    });

    const kept = await readFile(join(outputDir, "keep.cas.json"), "utf8");
    expect(JSON.parse(kept)).toEqual(["keep"]);
    expect(await readFile(outside, "utf8")).toBe("secret");
  });
});

test("deleteCasFiles: rejects an empty fileName before deleting any files", async () => {
  await withTempDir(async (dir) => {
    const outputDir = join(dir, "cas");

    await writeCasFile({
      fileName: "keep.cas.json",
      jwt: "keep",
      outputDir,
    });

    await expect(
      deleteCasFiles(["keep.cas.json", ""], outputDir),
    ).rejects.toMatchObject({
      name: "CaClientError",
      code: CaClientErrorCode.Validation,
      message: "fileName must be a non-empty string",
    });
    await expect(
      deleteCasFiles(["keep.cas.json", "   "], outputDir),
    ).rejects.toMatchObject({
      name: "CaClientError",
      code: CaClientErrorCode.Validation,
      message: "fileName must be a non-empty string",
    });

    const kept = await readFile(join(outputDir, "keep.cas.json"), "utf8");
    expect(JSON.parse(kept)).toEqual(["keep"]);
  });
});

test("deleteCasFiles: deletes multiple CAS files", async () => {
  await withTempDir(async (dir) => {
    const outputDir = join(dir, "cas");
    const names = ["one.cas.json", "two.cas.json"];
    await Promise.all(
      names.map((fileName) =>
        writeCasFile({
          fileName,
          jwt: fileName,
          outputDir,
        }),
      ),
    );

    await deleteCasFiles(names, outputDir);

    await Promise.all(
      names.map((name) =>
        expect(readFile(join(outputDir, name), "utf8")).rejects.toMatchObject({
          code: "ENOENT",
        }),
      ),
    );
  });
});

test("casFilePath: keeps nested fileName inside outputDir", () => {
  expect(
    casFilePath({
      fileName: "nested/page.cas.json",
      outputDir: "/workspace/cas",
    }),
  ).toBe(resolve("/workspace", "cas", "nested", "page.cas.json"));
});

test("casFilePath: allows a fileName whose .. segments stay inside outputDir", () => {
  expect(
    casFilePath({
      fileName: "nested/../page.cas.json",
      outputDir: "/workspace/cas",
    }),
  ).toBe(resolve("/workspace", "cas", "page.cas.json"));
});

test("casFilePath: rejects a fileName that escapes outputDir", () => {
  for (const fileName of [
    "../outside.cas.json",
    "../../etc/passwd",
    "nested/../../outside.cas.json",
    "/etc/passwd",
    ".",
    "..",
  ]) {
    expect(() =>
      casFilePath({ fileName, outputDir: "/workspace/cas" }),
    ).toThrow("fileName must stay inside outputDir");
  }
});

test("casFilePath: does not treat a name starting with .. as traversal", () => {
  expect(
    casFilePath({
      fileName: "..page.cas.json",
      outputDir: "/workspace/cas",
    }),
  ).toBe(resolve("/workspace", "cas", "..page.cas.json"));
});

test("resolveCasDir: resolves a relative path against process.cwd()", () => {
  expect(resolveCasDir("public/cas")).toBe(
    resolve(process.cwd(), "public", "cas"),
  );
  expect(resolveCasDir("./public/cas")).toBe(
    resolve(process.cwd(), "public", "cas"),
  );
});

test("resolveCasDir: returns an absolute path unchanged", () => {
  expect(resolveCasDir("/abs/cas")).toBe(resolve("/abs/cas"));
});

test("resolveCasDir: rejects an empty path so it is not resolved to the root", () => {
  for (const outputDir of ["", "   "]) {
    expect(() => resolveCasDir(outputDir)).toThrow(CaClientError);
    expect(() => resolveCasDir(outputDir)).toThrow(
      "outputDir must be a non-empty string",
    );
  }
});
