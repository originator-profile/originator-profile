import type { RawTarget } from "@originator-profile/model";
import { describe, expect, it, vi } from "vitest";
import {
  fetchAndSetTargetIntegrity,
  IntegrityCalculationError,
} from "./fetch-and-set-target-integrity";

describe("fetchAndSetTargetIntegrity()", () => {
  it("should update the target array with integrity", async () => {
    document.body.textContent = "ok";

    const uca = {
      target: [
        {
          type: "TextTargetIntegrity",
          cssSelector: "body",
        } satisfies RawTarget,
      ],
    };

    await fetchAndSetTargetIntegrity("sha256", uca);

    expect(uca.target).toEqual([
      {
        type: "TextTargetIntegrity",
        cssSelector: "body",
        integrity: "sha256-Jok2eyBcFs4y7UIAlCuLix4mLfxw2byfvHfElpmk8d8=",
      },
    ]);
  });

  it("should throw an IntegrityCalculationError if createIntegrity() returns null", async () => {
    const uca = {
      target: [
        {
          type: "TextTargetIntegrity",
          cssSelector: "non-existent-element",
        } satisfies RawTarget,
      ],
    };

    await expect(
      fetchAndSetTargetIntegrity("sha256", uca),
    ).rejects.toThrowError(
      new IntegrityCalculationError(
        `Failed to create integrity for element target[0].`,
      ),
    );
  });

  it("should remove content and keep integrity if integrity is provided", async () => {
    const uca = {
      target: [
        {
          type: "example",
          content: "example content",
          integrity: "existing-integrity",
        } as unknown as RawTarget,
      ],
    };

    await fetchAndSetTargetIntegrity("sha256", uca);

    expect(uca.target).toEqual([
      {
        type: "example",
        integrity: "existing-integrity",
      },
    ]);
  });

  it("should not call documentProvider for ExternalResourceTargetIntegrity", async () => {
    const documentProvider = vi.fn();

    const uca = {
      target: [
        {
          type: "ExternalResourceTargetIntegrity",
          content: ["data:text/plain,content1", "data:text/plain,content2"],
        } satisfies RawTarget,
      ],
    };

    await fetchAndSetTargetIntegrity("sha256", uca, documentProvider);

    expect(documentProvider).not.toHaveBeenCalled();
  });
});
