import { describe, expect, test } from "vitest";
import {
  buildWarningSearchParams,
  parseWarningSearchParams,
} from "./warning-params";

describe("warning-params", () => {
  test("round-trip: all fields", () => {
    const input = {
      target: "https://example.com/page",
      reason: "OPID mismatch",
      sourceOrg: "Advertiser Co.",
      destOrg: "Destination Inc.",
      expectedOrg: "Expected Ltd.",
      original: "https://source.example.com/ad",
      isNewTab: true,
    } as const;

    const sp = buildWarningSearchParams(input);
    const parsed = parseWarningSearchParams(sp);

    expect(parsed).toEqual(input);
  });

  test("round-trip: required fields only", () => {
    const input = {
      target: "https://example.com",
      reason: "some reason",
    } as const;

    const sp = buildWarningSearchParams(input);
    const parsed = parseWarningSearchParams(sp);

    expect(parsed).toEqual({
      target: "https://example.com",
      reason: "some reason",
      sourceOrg: undefined,
      destOrg: undefined,
      expectedOrg: undefined,
      original: undefined,
      isNewTab: undefined,
    });
  });

  test("isNewTab false is omitted from URLSearchParams", () => {
    const sp = buildWarningSearchParams({
      target: "https://example.com",
      reason: "reason",
      isNewTab: false,
    });

    expect(sp.get("isNewTab")).toBeNull();
  });

  test("parse: missing target and reason default to empty string", () => {
    const sp = new URLSearchParams();
    const parsed = parseWarningSearchParams(sp);

    expect(parsed.target).toBe("");
    expect(parsed.reason).toBe("");
  });
});
