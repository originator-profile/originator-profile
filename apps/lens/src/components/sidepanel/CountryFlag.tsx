import { useState } from "react";
import { twMerge } from "tailwind-merge";
import { uiLocale } from "../../utils/ui-locale";

/**
 * 国の表示名を、拡張機能の UI と同じ言語で得る
 * @param country ISO 3166-1 alpha-2 の国コード
 */
export function countryName(country: string): string {
  try {
    return (
      new Intl.DisplayNames([uiLocale()], { type: "region" }).of(country) ??
      country
    );
  } catch {
    return country;
  }
}

type Props = {
  /** ISO 3166-1 alpha-2 の国コード */
  country: string;
  /**
   * 国名を隣に併記しているか。併記していれば国旗を支援技術に読ませない
   * (読ませると国名が二重に読まれる)
   */
  decorative?: boolean;
  className?: string;
};

/**
 * 国旗
 *
 * 拡張機能に同梱した国旗 (flag-icons の 4:3) を、表示するときに読み込む。
 * 国旗の無い国では何も表示しない。国名は呼び出し側で併記する。
 */
export function CountryFlag({ country, decorative = false, className }: Props) {
  const code = country.toLowerCase();
  const [failed, setFailed] = useState<string>();
  if (failed === code) return null;
  return (
    <img
      className={twMerge(
        "block h-3 w-4 shrink-0 rounded-xs border-[0.5px] border-[#d9d9d9]",
        className,
      )}
      // NOTE: 拡張機能のルートからの相対 URL。ページの文脈で動く overlay の
      // iframe は chrome.runtime を使えないため、base 要素でルートを指している
      src={`flags/${code}.svg`}
      alt={decorative ? "" : countryName(country.toUpperCase())}
      width={16}
      height={12}
      onError={() => setFailed(code)}
    />
  );
}
