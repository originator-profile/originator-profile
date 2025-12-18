import { expect, test } from "vitest";
import { parseWithError, stringifyWithError } from "./safe-stringify";

test("stringifyWithError(): An error object is passed", () => {
  class TestError extends Error {
    private value: string;
    public constructor(message: string) {
      super(message);
      this.value = message;
    }
  }

  let result = stringifyWithError(new TestError("test message"));
  expect(typeof result).toBe("string");

  let parsedValue = parseWithError(result);
  expect("stack" in parsedValue).toBeTruthy();
  expect("message" in parsedValue).toBeTruthy();
  expect("value" in parsedValue).toBeTruthy();

  result = stringifyWithError(new Error("test message"));
  expect(typeof result).toBe("string");

  parsedValue = parseWithError(result);
  expect("stack" in parsedValue).toBeTruthy();
  expect("message" in parsedValue).toBeTruthy();
  expect(parsedValue instanceof Error).toBeTruthy();
});

test("stringifyWithError(): Unique object is passed", () => {
  const result = stringifyWithError({ value1: 1, value2: "value2" });
  expect(typeof result).toBe("string");

  const parsedValue = parseWithError(result);
  expect("value1" in parsedValue).toBeTruthy();
  expect("value2" in parsedValue).toBeTruthy();

  expect(parsedValue.value1).toBe(1);
  expect(parsedValue.value2).toBe("value2");
});

test("stringifyWithError(): Unique object with Error is passed", () => {
  const result = stringifyWithError({
    value1: 1,
    value2: "value2",
    value3: new Error("test message"),
  });
  expect(typeof result).toBe("string");

  const parsedValue = parseWithError(result);
  expect("value1" in parsedValue).toBeTruthy();
  expect("value2" in parsedValue).toBeTruthy();
  expect("value3" in parsedValue).toBeTruthy();

  expect(parsedValue.value1).toBe(1);
  expect(parsedValue.value2).toBe("value2");
  expect("stack" in parsedValue.value3).toBeTruthy();
  expect("message" in parsedValue.value3).toBeTruthy();
  expect(parsedValue.value3 instanceof Error).toBeTruthy();
});
