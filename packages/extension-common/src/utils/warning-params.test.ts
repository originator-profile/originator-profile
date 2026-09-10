import { describe, expect, test } from "vitest";
import {
  buildWarningSearchParams,
  parseWarningSearchParams,
} from "./warning-params";

describe("warning-params", () => {
  test("round-trip: all fields", () => {
    const input = {
      destinationUrl: "https://example.com/page",
      reason: "OPID mismatch",
      sourceOrg: "Advertiser Co.",
      expectedOrg: "Declared Ltd.",
      actualOrg: "Verified Inc.",
      sourceUrl: "https://source.example.com/ad",
      isNewTab: true,
    } as const;

    const sp = buildWarningSearchParams(input);
    const parsed = parseWarningSearchParams(sp);

    expect(parsed).toEqual(input);
  });

  test("round-trip: required fields only", () => {
    const input = {
      destinationUrl: "https://example.com",
      reason: "some reason",
    } as const;

    const sp = buildWarningSearchParams(input);
    const parsed = parseWarningSearchParams(sp);

    expect(parsed).toEqual({
      destinationUrl: "https://example.com",
      reason: "some reason",
      sourceOrg: undefined,
      expectedOrg: undefined,
      actualOrg: undefined,
      sourceUrl: undefined,
      isNewTab: undefined,
    });
  });

  test("isNewTab false is omitted from URLSearchParams", () => {
    const sp = buildWarningSearchParams({
      destinationUrl: "https://example.com",
      reason: "reason",
      isNewTab: false,
    });

    expect(sp.get("isNewTab")).toBeNull();
  });

  test("parse: missing destinationUrl and reason default to empty string", () => {
    const sp = new URLSearchParams();
    const parsed = parseWarningSearchParams(sp);

    expect(parsed.destinationUrl).toBe("");
    expect(parsed.reason).toBe("");
  });
});
