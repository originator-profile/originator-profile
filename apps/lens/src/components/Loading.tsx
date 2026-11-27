import { _ } from "@originator-profile/extension-common/ui";
import { twMerge } from "tailwind-merge";

/**
 * スケルトンの 1 行
 *
 * 表示後の画面の文字と同じ指定の行の中に帯を置き、行の高さを表示後と揃える
 * @param text 表示後の画面の文字の指定
 * @param bar 帯の幅と高さ
 */
function Line({ text, bar }: { text: string; bar: string }) {
  return (
    <div className={text}>
      <span
        className={twMerge(
          "inline-block rounded-xs bg-gray-200 align-middle",
          bar,
        )}
      />
    </div>
  );
}

/** スケルトンのアコーディオン (OriginatorAccordion の閉じた形) */
function Accordion() {
  return (
    <div className="rounded-[0.625rem] border border-gray-300 bg-white">
      <div className="flex min-h-12 items-center gap-2 py-3 pr-2 pl-4">
        <span className="size-6 shrink-0 rounded-xs bg-gray-200" />
        <Line text="text-sm leading-[1.3]" bar="h-3.5 w-36" />
      </div>
    </div>
  );
}

/**
 * 読み込み中の表示
 *
 * 表示後の画面 (サイトの運営者とコンテンツのカード) の形を灰色で描き、切り替わる
 * ときに色と位置が跳ばないようにする。余白と文字の指定は表示後の画面
 * (SiteHeader、ContentList、ContentCard) に揃える。
 */
function Loading({ origin }: { origin?: string }) {
  return (
    <main className="min-h-screen bg-gray-100">
      <p className="sr-only" role="status">
        {_(
          "Loading_RetrievingAndValidatingProfile",
          origin && _("Loading_OfOrigin", origin),
        )}
      </p>
      <div
        className="flex flex-col gap-3 px-4 py-6 motion-safe:animate-pulse"
        aria-hidden
      >
        <div className="flex flex-col gap-2">
          <Line text="text-sm leading-[1.35]" bar="h-3.5 w-32" />
          <Line text="text-xs" bar="h-3 w-16" />
          <Accordion />
        </div>
        <div className="flex flex-col gap-2 rounded-2xl bg-white p-4">
          <Line text="text-xs" bar="h-3 w-12" />
          <div className="flex flex-col gap-3.5 rounded-2xl border border-gray-200 p-4">
            <div>
              <Line text="text-sm leading-[1.35]" bar="h-3.5 w-full" />
              <Line text="text-sm leading-[1.35]" bar="h-3.5 w-2/3" />
            </div>
            <div className="flex flex-col gap-2">
              <Line text="text-xs" bar="h-3 w-12" />
              <Accordion />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default Loading;
