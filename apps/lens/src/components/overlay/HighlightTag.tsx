import { Image } from "@originator-profile/extension-common/ui";
import placeholderLogoMainUrl from "@originator-profile/extension-common/ui/assets/placeholder-logo-main.png";
import { twMerge } from "tailwind-merge";
import type { HighlightLabel } from "../../overlay/protocol";
import { CountryFlag } from "../sidepanel/CountryFlag";

/** タグの置き方。コンテンツは範囲の上に、ページ全体は枠の内側の上端に置く */
export type HighlightTagPlacement = "above" | "inside";

const logoSize: Record<HighlightTagPlacement, number> = {
  above: 16,
  inside: 24,
};

/**
 * しっぽ。本体の外側に接する三角形を疑似要素で描く
 *
 * NOTE: 本体と重ねて描くと、半透明の背景が重なったところだけ濃くなり、影も
 * 別々に付く。重ねずに接させれば、本体の drop-shadow が一体の形に付く
 */
const tail: Record<HighlightTagPlacement, string> = {
  above:
    "after:top-full after:border-x-8 after:border-t-8 after:border-x-transparent after:border-t-white/90",
  inside:
    "after:bottom-full after:border-x-8 after:border-b-8 after:border-x-transparent after:border-b-white/90",
};

/** 強調した範囲に添える、発信者の組織のタグ */
export function HighlightTag({
  label,
  placement,
}: {
  label: HighlightLabel;
  placement: HighlightTagPlacement;
}) {
  const size = logoSize[placement];
  return (
    <div
      className={twMerge(
        "relative flex items-center gap-2 rounded-lg bg-white/90 px-4 py-2 drop-shadow-floating after:absolute after:left-1/2 after:-translate-x-1/2",
        tail[placement],
      )}
    >
      <Image
        className="shrink-0"
        src={label.logo}
        placeholderSrc={placeholderLogoMainUrl}
        alt=""
        width={size}
        height={size}
      />
      <p className="text-xs font-medium whitespace-nowrap text-black">
        {label.name}
      </p>
      {label.country && <CountryFlag country={label.country} />}
    </div>
  );
}
