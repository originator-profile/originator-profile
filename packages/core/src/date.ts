import { Temporal } from "@js-temporal/polyfill";
import { isBefore } from "date-fns/fp";

/**
 * 有効期限の文字列表現のパース
 * @param input 入力
 * @example ISO 8601 形式の日付の場合、その日を有効期限とみなします
 * parseExpirationDate("2023-07-31") // 2023-07-31T15:00:00.000Z (タイムゾーンが省略された場合、実行環境のタイムゾーンに従い解釈されます)
 * @example 時刻が含まれる場合、期限切れとなる日時とみなします
 * parseExpirationDate("2023-07-31T24:00:00.000+09:00") // 2023-07-31T15:00:00.000Z
 * @return 期限切れ日時
 */
export function parseExpirationDate(input: string): Date {
  try {
    return new Date(Temporal.Instant.from(input).epochMilliseconds);
  } catch {
    // nop
  }

  try {
    return new Date(
      Temporal.PlainDate.from(input)
        .add({ days: 1 })
        .toZonedDateTime(Temporal.Now.timeZoneId()).epochMilliseconds,
    );
  } catch {
    // nop
  }

  return new Date(input);
}

/**
 * ロケールの表記規則に従って有効期限日付時刻文字列表現に変換
 * @param expiredAt 期限切れ日時
 * @param locale ロケール (デフォルト: 実行環境のロケールに従います)
 * @example Dateオブジェクトの場合、1秒減らした時間を表示します (実行環境のロケールに従います)
 * expirationDateTimeLocaleFrom(new Date("2023-07-31T24:00:00.000+09:00")) // "2023/7/31 23:59:59"
 * @example 文字列の場合、`expirationDateTimeLocaleFrom(new Date(expiredAtString))` を実行するのと同じです
 * expirationDateTimeLocaleFrom("2023-07-31T24:00:00.000+09:00") // "2023/7/31 23:59:59"
 * @return 有効期限の文字列表現
 */
export function expirationDateTimeLocaleFrom(
  expiredAt: Date | string,
  locale?: Intl.LocalesArgument,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Date(new Date(expiredAt).getTime() - 1).toLocaleString(
    locale,
    options,
  );
}

/**
 * 現在時刻において期限切れかどうかを判定する
 * @param expiredAt 期限切れ日時
 * @example
 * isExpired("2023-07-31T24:00:00.000+09:00") // 現在時刻が 2023-07-31T24:00:00.000+09:00 の場合 true, それより後の場合も true, それより前の場合は false
 * @return 期限切れの場合 true, そうでない場合 false
 */
export function isExpired(expiredAt: Date | string) {
  const expirationDate =
    typeof expiredAt === "string" ? parseExpirationDate(expiredAt) : expiredAt;
  return !isBefore(expirationDate, new Date());
}

/**
 * 発行日時の文字列表現のパース
 * @param input 入力
 * @example ISO 8601 形式の日付の場合、その日の開始を発行日時とみなします
 * parseIssuanceDate("2023-07-31") // 2023-07-30T15:00:00.000Z (タイムゾーンが省略された場合、実行環境のタイムゾーンに従い解釈されます)
 * @example 時刻が含まれる場合、発行日時とみなします
 * parseIssuanceDate("2023-07-31T24:00:00.000+09:00") // 2023-07-31T15:00:00.000Z
 * @return 発行日時
 */
export function parseIssuanceDate(input: string): Date {
  try {
    return new Date(Temporal.Instant.from(input).epochMilliseconds);
  } catch {
    // nop
  }

  try {
    return new Date(
      Temporal.PlainDate.from(input).toZonedDateTime(Temporal.Now.timeZoneId())
        .epochMilliseconds,
    );
  } catch {
    // nop
  }

  return new Date(input);
}

/**
 * 日付をデフォルトロケールの長い形式の文字列に変換
 * @param date 日付
 * @returns デフォルトロケールの長い形式の文字列
 */
export function formatLocaleDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
