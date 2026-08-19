import { expect, test } from "vitest";
import {
  CaClientError,
  CaClientErrorCode,
  isUnauthorized,
} from "./errors";

test("isUnauthorized: is true only for CA HTTP 401", () => {
  expect(
    isUnauthorized(
      new CaClientError("CA signing failed: 401 Unauthorized: expired", {
        code: CaClientErrorCode.Http,
        status: 401,
      }),
    ),
  ).toBe(true);

  expect(
    isUnauthorized(
      new CaClientError("CCSP auth failed: 401 Unauthorized: nope", {
        code: CaClientErrorCode.Auth,
        status: 401,
      }),
    ),
  ).toBe(false);

  expect(
    isUnauthorized(
      new CaClientError("CA signing failed: 500 Internal Server Error: x", {
        code: CaClientErrorCode.Http,
        status: 500,
      }),
    ),
  ).toBe(false);

  expect(
    isUnauthorized(new Error("CA API error: 401 Unauthorized: token expired")),
  ).toBe(false);
});
