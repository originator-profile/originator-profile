import { z } from "zod";

/**
 * xsd:dateTimeStamp 形式の文字列スキーマ。
 * タイムゾーン指定（Z または ±HH:MM）を必須とする。
 * @see https://www.w3.org/TR/xmlschema11-2/#dateTimeStamp
 */
export const DateTimeStamp = z.iso.datetime({
  offset: true,
  error:
    "Must be an xsd:dateTimeStamp string (e.g. 2024-01-01T00:00:00Z or 2024-01-01T00:00:00+09:00)",
});

export type DateTimeStamp = z.infer<typeof DateTimeStamp>;
