import { twMerge } from "tailwind-merge";
import jpFlagUrl from "../../assets/flags/jp.svg";
import gbFlagUrl from "../../assets/flags/gb.svg";
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

function UsFlag({ label }: { label?: string }) {
  return (
    <span
      className="relative block h-3 w-[18px] overflow-clip rounded-[2px] border-[0.5px] border-[#d9d9d9] bg-white"
      {...(label
        ? { role: "img", "aria-label": label }
        : { "aria-hidden": true })}
    >
      {[0, 1, 2, 3, 4, 5, 6].map((stripe) => (
        <span
          key={stripe}
          className="absolute left-[-0.5px] h-[0.923px] w-[18px] bg-[#b22234]"
          style={{ top: `${-0.5 + stripe * 1.846}px` }}
        />
      ))}
      <span className="absolute top-[-0.5px] left-[-0.5px] h-[6.462px] w-[7.2px] bg-[#3c3b6e]" />
    </span>
  );
}

const flagUrls: Record<string, string> = {
  JP: jpFlagUrl,
  GB: gbFlagUrl,
};

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
 * 国旗を用意していない国では何も表示しない。国名は呼び出し側で併記する。
 */
export function CountryFlag({ country, decorative = false, className }: Props) {
  const code = country.toUpperCase();
  const label = decorative ? undefined : countryName(code);
  const flagUrl = flagUrls[code];
  if (code !== "US" && !flagUrl) return null;
  return (
    <span className={twMerge("block shrink-0", className)}>
      {flagUrl ? (
        <img src={flagUrl} alt={label ?? ""} width={18} height={12} />
      ) : (
        <UsFlag label={label} />
      )}
    </span>
  );
}
