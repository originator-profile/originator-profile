import Ajv from "ajv";
import { expect, test } from "vitest";
import { OpVc } from "../src/op-vc";

test("op vc schema is valid", () => {
  const ajv = new Ajv();
  const valid = ajv.validateSchema(OpVc);
  expect(valid).toBe(true);
});
