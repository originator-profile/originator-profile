import IconArrowUpRightFromSquare from "@iconify-react/fa6-solid/arrow-up-right-from-square";
import { _ } from "@originator-profile/extension-common/ui";
import type { ReactNode } from "react";

/** 外部サイトへのリンク。新しいタブで開く */
export function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      className="flex items-center gap-2 self-start text-xs leading-normal font-medium text-black underline transition-[text-decoration-thickness] hover:decoration-2"
      href={href}
      target="_blank"
      rel="noreferrer noopener"
    >
      {children}
      <IconArrowUpRightFromSquare
        className="size-2 text-gray-500"
        aria-hidden
      />
      <span className="sr-only">{_("Link_OpensInNewTab")}</span>
    </a>
  );
}
