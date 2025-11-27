import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { test } from "node:test";
import pkg from "../package.json" with { type: "json" };

function extractExportPaths(
  exports: unknown,
  collected: Set<string> = new Set(),
): Set<string> {
  if (typeof exports === "string") {
    collected.add(exports);
  } else if (Array.isArray(exports)) {
    for (const item of exports) {
      extractExportPaths(item, collected);
    }
  } else if (exports !== null && typeof exports === "object") {
    for (const value of Object.values(exports)) {
      extractExportPaths(value, collected);
    }
  }
  return collected;
}

await test("package.json exports field validation", async () => {
  const exportPaths = extractExportPaths(pkg.exports);
  assert.ok(0 < exportPaths.size, "No export paths found in package.json");

  const missingFiles: Array<string> = [];
  for (const path of exportPaths) {
    await fs.access(path).catch(() => missingFiles.push(path));
  }
  assert.ok(missingFiles.length === 0, `Missing files: ${missingFiles.join()}`);
});
