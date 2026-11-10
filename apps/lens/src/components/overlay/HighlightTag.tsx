import { Image } from "@originator-profile/extension-common/ui";
import placeholderLogoMainUrl from "@originator-profile/extension-common/ui/assets/placeholder-logo-main.png";
import type { CSSProperties, Ref } from "react";
import { twMerge } from "tailwind-merge";
import type { HighlightLabel } from "../../overlay/protocol";
import { CountryFlag } from "../sidepanel/CountryFlag";

/**
 * しっぽ。本体の外側に接する三角形を疑似要素で描く
 *
 * NOTE: 本体と重ねて描くと、半透明の背景が重なったところだけ濃くなり、影も
 * 別々に付く。重ねずに接させれば、本体の drop-shadow が一体の形に付く
 */
const tail = {
  down: "after:top-full after:border-t-8 after:border-t-white/90",
  up: "after:bottom-full after:border-b-8 after:border-b-white/90",
};

type Props = {
  label: HighlightLabel;
  /** しっぽの向き */
  direction: keyof typeof tail;
  /** しっぽの x 座標 (タグの左端から)。未指定なら中央 */
  tailX?: number;
  /** ロゴを大きく出す (ページ全体の強調) */
  large?: boolean;
  ref?: Ref<HTMLDivElement>;
};

/**
 * 強調した範囲に添える、発信者の組織のタグ
 *
 * 形を保つため幅に上限を設け、組織名が収まらなければ末尾を省略する
 */
export function HighlightTag({
  label,
  direction,
  tailX,
  large = false,
  ref,
}: Props) {
  const size = large ? 24 : 16;
  return (
    <div
      ref={ref}
      className={twMerge(
        "relative flex max-w-[min(20rem,calc(100vw-1rem))] items-center gap-2 rounded-lg bg-white/90 px-4 py-2 whitespace-nowrap drop-shadow-floating after:absolute after:left-(--tail-x) after:-translate-x-1/2 after:border-x-8 after:border-x-transparent",
        tail[direction],
      )}
      style={
        {
          "--tail-x": tailX === undefined ? "50%" : `${tailX}px`,
        } as CSSProperties
      }
    >
      <Image
        className="shrink-0"
        src={label.logo}
        placeholderSrc={placeholderLogoMainUrl}
        alt=""
        width={size}
        height={size}
      />
      <p className="min-w-0 truncate text-xs font-medium text-black">
        {label.name}
      </p>
      {label.country && <CountryFlag country={label.country} />}
    </div>
  );
}
