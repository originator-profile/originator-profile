import { describe, expect, test } from "vitest";
import { route } from "./routes";

const exampleRoute = route("/a/:b/c/d/:e");

describe("routes", () => {
  test("routes() returns route path", () => {
    expect(exampleRoute.path).toBe("/a/:b/c/d/:e");
  });

  test("build() generates path", () => {
    expect(exampleRoute.build({ b: "b", e: "e" })).toBe("/a/b/c/d/e");
  });

  test("build() throws error if any params not found", () => {
    // @ts-expect-error assert
    expect(() => exampleRoute.build({ b: "b" })).toThrow();
  });
});
