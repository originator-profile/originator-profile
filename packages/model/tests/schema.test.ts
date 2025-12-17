import Ajv from "ajv";
import { expect, test } from "vitest";
import Dp from "../src/deprecated/dp";
import Op from "../src/deprecated/op";

test("op schema is valid", () => {
  const ajv = new Ajv();
  const valid = ajv.validateSchema(Op);
  expect(valid).toBe(true);
});

test("dp schema is valid", () => {
  const ajv = new Ajv();
  const valid = ajv.validateSchema(Dp);
  expect(valid).toBe(true);
});
