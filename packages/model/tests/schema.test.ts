import { expect, test } from "vitest";
import Dp from "../src/deprecated/dp";
import Op from "../src/deprecated/op";

test("op schema is valid", () => {
  const sampleOp = {
    type: "op" as const,
    issuer: "https://example.com/issuer",
    subject: "https://example.com/subject",
    issuedAt: "2024-01-01T00:00:00Z",
    expiredAt: "2025-01-01T00:00:00Z",
    item: [],
    jwks: { keys: [] },
  };
  const result = Op.safeParse(sampleOp);
  expect(result.success).toBe(true);
});

test("dp schema is valid", () => {
  const sampleDp = {
    type: "dp" as const,
    issuer: "https://example.com/issuer",
    subject: "https://example.com/subject",
    issuedAt: "2024-01-01T00:00:00Z",
    expiredAt: "2025-01-01T00:00:00Z",
    item: [],
    allowedOrigins: [],
  };
  const result = Dp.safeParse(sampleDp);
  expect(result.success).toBe(true);
});
