import type { TabView } from "./tab-view";

type Ready = Extract<TabView, { state: "ready" }>;

/** ランチャーアイコンの種類 */
export type LauncherIcon =
  /** Site Profile とメインのコンテンツの両方を確認できた */
  | "verified"
  /** Site Profile、メインのコンテンツ、ページ本体のそれ以外のコンテンツのどれかを確認できた */
  | "partial"
  /** 出どころが無いか、埋め込みのコンテンツにだけあるか、確認できなかった */
  | "none";

/** ランチャーアイコンとツールチップ */
export type Launcher = {
  icon: LauncherIcon;
  /** ツールチップの文言のキー */
  tooltip: string;
};

/**
 * ランチャーアイコンとツールチップを決める
 *
 * トップレベル文書を対象に、アイコンを上から順に判定して決める。ツールチップは、
 * 決まったアイコンのなかで何を確認できたかで選ぶ。
 * @param view タブの表示
 */
export function launcherOf({ site, contents, failed }: Ready): Launcher {
  const hasSite = site.state !== "absent";
  const hasMain = contents.some(({ main }) => main);
  const hasPageContent = contents.some(({ frames }) =>
    frames.some(({ frameType }) => frameType === "outermost_frame"),
  );

  if (hasSite && hasMain) {
    return { icon: "verified", tooltip: "Launcher_SiteAndMain" };
  }
  if (hasSite) return { icon: "partial", tooltip: "Launcher_SiteOnly" };
  if (hasMain) return { icon: "partial", tooltip: "Launcher_MainOnly" };
  if (hasPageContent) {
    return { icon: "partial", tooltip: "Launcher_PageContentOnly" };
  }
  if (failed) return { icon: "none", tooltip: "Launcher_Failed" };
  if (contents.length > 0) {
    return { icon: "none", tooltip: "Launcher_EmbeddedOnly" };
  }
  return { icon: "none", tooltip: "Launcher_NoOrigin" };
}
