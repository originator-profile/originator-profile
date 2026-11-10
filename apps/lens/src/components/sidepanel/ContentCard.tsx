import { _ } from "@originator-profile/extension-common/ui";
import type { ReactNode } from "react";
import type { Content } from "../../view";
import { Thumbnail } from "./Thumbnail";

type Props = {
  content: Content;
  /** 作成者の表示。作成者を確認できなければ undefined */
  originator?: ReactNode;
};

/**
 * コンテンツのカード
 *
 * メインのコンテンツはタイトルだけを、それ以外はサムネイルとタイトルを示す。
 */
export function ContentCard({ content, originator }: Props) {
  const { main, title, image } = content;
  return (
    <article
      className="jumpu-card flex w-full flex-col gap-3.5 rounded-2xl border-gray-200 p-4"
      data-testid="content-card"
    >
      {main ? (
        title && (
          <h3 className="text-sm leading-[1.35] font-bold text-black">
            {title}
          </h3>
        )
      ) : (
        <div className="flex items-center gap-2.5">
          {image && <Thumbnail key={image} src={image} />}
          {title && (
            <h3 className="min-w-0 flex-1 text-xs leading-[1.35] font-bold text-black">
              {title}
            </h3>
          )}
        </div>
      )}
      {originator && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-black">
            {_("Sidepanel_Originator")}
          </p>
          {originator}
        </div>
      )}
    </article>
  );
}

/** メインのコンテンツが無いことを示すカード */
export function NoMainContentCard() {
  return (
    <p className="jumpu-card w-full rounded-2xl border-gray-200 p-4 text-sm leading-[1.35] font-medium text-black">
      {_("Sidepanel_NoMainContent")}
    </p>
  );
}
