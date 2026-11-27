import { _ } from "@originator-profile/extension-common/ui";
import { useState, type ReactNode } from "react";
import type { Content } from "../../view";
import { Thumbnail } from "./Thumbnail";

type Props = {
  content: Content;
  /** 提供者の表示。提供者を確認できなければ undefined */
  provider?: ReactNode;
};

/**
 * コンテンツのカード
 *
 * メインのコンテンツはタイトルだけを、それ以外はサムネイルとタイトルを示す。
 * サムネイルが無いか読み込めなければタイトルを詰め、タイトルも無ければその行を出さない。
 */
export function ContentCard({ content, provider }: Props) {
  const { main, title, image } = content;
  const [failedImage, setFailedImage] = useState<string>();
  const thumbnail = image !== failedImage ? image : undefined;
  return (
    <article
      className="flex w-full flex-col gap-3.5 rounded-2xl border border-gray-200 bg-white p-4"
      data-testid="content-card"
    >
      {main
        ? title && (
            <h3 className="text-sm leading-[1.35] font-bold wrap-anywhere text-black">
              {title}
            </h3>
          )
        : (thumbnail || title) && (
            <div className="flex items-center gap-2.5">
              {thumbnail && (
                <Thumbnail
                  src={thumbnail}
                  onError={() => setFailedImage(thumbnail)}
                />
              )}
              {title && (
                <h3 className="min-w-0 flex-1 text-xs leading-[1.35] font-bold wrap-anywhere text-black">
                  {title}
                </h3>
              )}
            </div>
          )}
      {provider && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-black">
            {_("Sidepanel_Provider")}
          </p>
          {provider}
        </div>
      )}
    </article>
  );
}

/** 提供者の情報を確認できないことを示すカード */
export function NoProviderCard() {
  return (
    <p className="w-full rounded-2xl border border-gray-200 bg-white p-4 text-xs leading-[1.35] font-bold text-black">
      {_("Sidepanel_NoProvider")}
    </p>
  );
}
