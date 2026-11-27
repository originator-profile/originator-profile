import { overlayExtensionMessenger } from "@originator-profile/extension-common";
import { _ } from "@originator-profile/extension-common/ui";
import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { highlightOf } from "../../overlay/highlight";
import { lensOverlayMessenger } from "../../overlay/protocol";
import {
  detailOf,
  sectionsOf,
  type ContentCategory,
  type Organization,
  type TabView,
} from "../../view";
import { OrganizationDetail } from "../detail/OrganizationDetail";
import { ContentCard, NoProviderCard } from "./ContentCard";
import { OriginatorAccordion } from "./OriginatorAccordion";
import { SiteHeader } from "./SiteHeader";

const categoryLabels: Record<ContentCategory, string> = {
  article: "ContentType_Article",
  advertorial: "ContentType_Advertorial",
  media: "ContentType_Media",
  unknown: "ContentType_Unknown",
  advertisement: "ContentType_Advertisement",
};

type Props = Extract<TabView, { state: "ready" }>;

/** 運営者とコンテンツの提供者のうち、OP ID の一致する組織 */
function findOrganization(
  { site, issuers }: Props,
  id: string,
): Organization | undefined {
  if (site.state === "present" && site.operator.id === id) return site.operator;
  return issuers.get(id);
}

/** 開いているアコーディオンに対応する範囲をページ上で強調する */
function useHighlight(props: Props, openKey: string | undefined) {
  const { tabId } = props;
  const highlight = highlightOf(props, openKey);
  const sendHighlight = useEffectEvent(() => {
    if (highlight) {
      void lensOverlayMessenger.sendMessage("showHighlight", highlight, tabId);
    } else {
      void overlayExtensionMessenger.sendMessage("leave", null, tabId);
    }
  });
  // NOTE: 表示は検証の状態が変わるたびに作り直される。送り直すのは、強調を
  // 決める値が変わったときだけにする。コンテンツの範囲は、CA と文書が同じなら
  // 変わらない。開いていたコンテンツが一覧から消えると documentIds が外れ、
  // 強調を終える
  const documentIds =
    highlight?.kind === "content"
      ? highlight.frames.map(({ documentId }) => documentId).join()
      : undefined;
  const label = highlight?.label;
  useEffect(() => {
    sendHighlight();
  }, [tabId, openKey, documentIds, label?.name, label?.logo, label?.country]);
  useEffect(
    () => () => {
      void overlayExtensionMessenger.sendMessage("leave", null, tabId);
    },
    [tabId],
  );
}

/**
 * Web サイトの運営者と、ページのコンテンツの一覧
 *
 * 組織の詳細は一覧に重ねて表示する。一覧は残したまま操作できなくし、戻ったときに
 * アコーディオンの開閉とスクロール位置を保つ。詳細の組織が一覧から消えたら一覧に戻る。
 *
 * NOTE: アコーディオンは同時に 1 つしか開かない
 */
export function ContentList(props: Props) {
  const { site, contents, issuers, originators } = props;
  // NOTE: 開いているアコーディオン。Web サイトの運営者は "site"、コンテンツは key
  const [openKey, setOpenKey] = useState<string>();
  const [detailId, setDetailId] = useState<string>();
  const detailTrigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  useHighlight(props, openKey);

  const detailOrganization =
    detailId === undefined ? undefined : findOrganization(props, detailId);
  const showingDetail = detailOrganization !== undefined;
  // 詳細の組織が一覧から消えたら詳細を閉じる。一覧に戻ってきても開き直さない
  if (detailId !== undefined && !showingDetail) setDetailId(undefined);
  // 詳細から戻ったら、詳細を開いたボタンにフォーカスを返す。ボタンが一覧から
  // 消えていれば一覧の先頭に移す
  useEffect(() => {
    const trigger = detailTrigger.current;
    if (showingDetail || !trigger) return;
    detailTrigger.current = null;
    (trigger.isConnected ? trigger : list.current)?.focus();
  }, [showingDetail]);

  const name = useId();
  const toggle = (key: string) => (open: boolean) =>
    setOpenKey((current) => {
      if (open) return key;
      return current === key ? undefined : current;
    });
  const accordion = (
    key: string,
    organization: Organization,
    roleLabel: string,
  ) => (
    <OriginatorAccordion
      organization={organization}
      roleLabel={roleLabel}
      name={name}
      open={openKey === key}
      onToggle={toggle(key)}
      onShowDetail={(button) => {
        detailTrigger.current = button;
        setDetailId(organization.id);
      }}
    />
  );

  const sections = sectionsOf(contents);
  const hasMain = contents.some(({ main }) => main);

  return (
    <>
      <div
        ref={list}
        className="flex flex-col gap-3 bg-gray-100 px-4 py-6 focus:outline-none"
        tabIndex={-1}
        inert={showingDetail}
      >
        <SiteHeader
          site={site}
          operator={
            site.state === "present" &&
            accordion("site", site.operator, _("Sidepanel_SiteOperatorLabel"))
          }
        />
        <div className="flex flex-col gap-6 rounded-2xl bg-white p-4">
          {!hasMain && (
            <section className="flex flex-col gap-2">
              <h2 className="text-xs font-medium text-black">
                {_(
                  contents.length > 0
                    ? "ContentType_MainContent"
                    : "ContentType_Content",
                )}
              </h2>
              <NoProviderCard />
            </section>
          )}
          {sections.map(({ category, contents }) => (
            <section key={category} className="flex flex-col gap-2">
              <h2 className="text-xs font-medium text-black">
                {_(categoryLabels[category])}
              </h2>
              <div className="flex flex-col gap-3">
                {contents.map((content) => {
                  const issuer = issuers.get(content.issuer);
                  return (
                    <ContentCard
                      key={content.key}
                      content={content}
                      provider={
                        issuer &&
                        accordion(
                          content.key,
                          issuer,
                          _("Sidepanel_ProviderLabel"),
                        )
                      }
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
      {detailOrganization && (
        <OrganizationDetail
          detail={detailOf(detailOrganization, originators)}
          onBack={() => setDetailId(undefined)}
        />
      )}
    </>
  );
}
