/**
 * JSONPath を組み立てる
 *
 * 文字列は property、数値は index として連結する。
 * @example
 * ```ts
 * pointer("originators", 0, "annotations", 1); // "$.originators[0].annotations[1]"
 * ```
 */
export function pointer(...segments: (string | number)[]): string {
  return segments.reduce<string>(
    (path, segment) =>
      typeof segment === "number"
        ? `${path}[${segment}]`
        : `${path}.${segment}`,
    "$",
  );
}
