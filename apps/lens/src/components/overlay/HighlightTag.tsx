import { Image } from "@originator-profile/extension-common/ui";
import placeholderLogoMainUrl from "@originator-profile/extension-common/ui/assets/placeholder-logo-main.png";
import { twMerge } from "tailwind-merge";
import tooltipTailUrl from "../../assets/tooltip-tail.svg";
import type { HighlightLabel } from "../../overlay/protocol";
import { CountryFlag } from "../sidepanel/CountryFlag";

/** タグの置き方。コンテンツは範囲の上に、ページ全体は枠の内側の上端に置く */
export type HighlightTagPlacement = "above" | "inside";

const logoSize: Record<HighlightTagPlacement, number> = {
  above: 16,
  inside: 24,
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
    <div className="relative flex items-center gap-2 rounded-lg bg-white/90 px-4 py-2 drop-shadow-[0_0_2px_rgba(0,0,0,0.1)] drop-shadow-[0_1px_0.5px_rgba(0,0,0,0.3)]">
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
      <img
        className={twMerge(
          "absolute left-1/2 -translate-x-1/2",
          placement === "above"
            ? "-bottom-[5.5px] -rotate-45"
            : "-top-[5.5px] rotate-135",
        )}
        src={tooltipTailUrl}
        alt=""
        width={11}
        height={11}
      />
    </div>
  );
}
