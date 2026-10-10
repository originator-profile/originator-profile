import { expect, test, vi } from "vitest";
import { setupOnce } from "./setup-once";

test("同じ名前のセットアップは 2 度目を実行しない", () => {
  const setup = vi.fn();
  setupOnce("setup-once-test", setup);
  setupOnce("setup-once-test", setup);

  expect(setup).toHaveBeenCalledTimes(1);
});

test("名前が異なればそれぞれ実行する", () => {
  const first = vi.fn();
  const second = vi.fn();
  setupOnce("setup-once-test-a", first);
  setupOnce("setup-once-test-b", second);

  expect(first).toHaveBeenCalledTimes(1);
  expect(second).toHaveBeenCalledTimes(1);
});
