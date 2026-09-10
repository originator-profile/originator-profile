const append = (path: string, segments: (string | number)[]): string =>
  segments.reduce<string>(
    (acc, segment) =>
      typeof segment === "number" ? `${acc}[${segment}]` : `${acc}.${segment}`,
    path,
  );

/**
 * JSONPath を組み立てる
 *
 * 文字列は property、数値は index として連結する。
 * @example
 * ```ts
 * pointer("originators", 0, "annotations", 1); // "$.originators[0].annotations[1]"
 * ```
 */
export const pointer = (...segments: (string | number)[]): string =>
  append("$", segments);

/**
 * 既存の JSONPath に続けて組み立てる
 * @example
 * ```ts
 * childPointer("$.documents[0]", "cas", 1); // "$.documents[0].cas[1]"
 * ```
 */
export const childPointer = (
  base: string,
  ...segments: (string | number)[]
): string => append(base, segments);
