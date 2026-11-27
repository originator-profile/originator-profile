import IconChevronLeft from "@iconify-react/fa6-solid/chevron-left";
import { _, Image } from "@originator-profile/extension-common/ui";
import placeholderLogoMainUrl from "@originator-profile/extension-common/ui/assets/placeholder-logo-main.png";
import { useEffect, useId, useRef, useState } from "react";
import { twMerge } from "tailwind-merge";
import type { OrganizationDetail as Detail } from "../../view";
import { OrganizationFacts } from "../sidepanel/OrganizationFacts";
import { AnnotationGroupView } from "./AnnotationGroupView";
import { ExternalLink } from "./ExternalLink";

// TODO: 「このツールについて」のリンク先の URL が確定したら差し替える
const aboutUrl = "https://originator-profile.org/";

/** 組織が公表している方針のリンク */
function policyLinksOf({ organization }: Detail) {
  const subject = organization.media?.credentialSubject;
  if (!subject) return [];
  return [
    subject.informationTransmissionPolicy,
    subject.publishingPrinciple,
    subject.privacyPolicy,
    { id: subject.url, name: _("Sidepanel_OfficialSite") },
  ].filter((link) => link !== undefined);
}

/**
 * 固定したヘッダーの高さを、スクロールする容器の scroll-padding-top にする
 *
 * NOTE: フォーカスを移したときのスクロールで、移った先がヘッダーの裏に隠れない
 * ようにする。ヘッダーの高さは組織名や言語による折り返しで変わる
 */
function useHeaderScrollPadding() {
  const container = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLElement>(null);
  useEffect(() => {
    const target = header.current;
    if (!target) return;
    const observer = new ResizeObserver(([entry]) => {
      const height = entry?.borderBoxSize[0]?.blockSize;
      if (container.current && height !== undefined) {
        container.current.style.scrollPaddingTop = `${height}px`;
      }
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);
  return { container, header };
}

/**
 * 表示しているあいだ、後ろの一覧 (文書) をスクロールさせない
 *
 * NOTE: overflow: hidden でも文書のスクロール位置は保たれ、戻ったときに一覧の
 * 位置が変わらない
 */
function useDocumentScrollLock() {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, []);
}

const prefersReducedMotion = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches;

type Props = {
  detail: Detail;
  /** 戻り終えたとき */
  onBack: () => void;
};

/**
 * 組織の詳細の画面
 *
 * コンテンツの一覧から切り替わる画面として扱う。右からスライドインし (後ろの一覧は
 * 白くかすむ)、表示したら組織名の見出しにフォーカスを移す。戻るときは右へ
 * スライドアウトしてから onBack を呼ぶ。
 * 一覧を残したまま上に重ねて描くのは、戻ったときに一覧の状態を保つためで、
 * 一覧は呼び出し側で操作できなくする。
 */
export function OrganizationDetail({ detail, onBack }: Props) {
  const { organization, groups } = detail;
  const subject = organization.media?.credentialSubject;
  const name = subject?.name ?? organization.id;
  const links = policyLinksOf(detail);
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const { container, header } = useHeaderScrollPadding();
  useDocumentScrollLock();
  const [leaving, setLeaving] = useState(false);
  useEffect(() => heading.current?.focus(), []);

  const back = () => {
    // NOTE: 動きを減らす設定では遷移しないため transitionend が届かない
    if (prefersReducedMotion()) onBack();
    else setLeaving(true);
  };

  return (
    <>
      <div
        className={twMerge(
          "fixed inset-0 z-10 bg-white/50 transition-opacity starting:opacity-0 motion-reduce:transition-none",
          leaving && "opacity-0",
        )}
        aria-hidden
      />
      <section
        ref={container}
        className={twMerge(
          "fixed inset-0 z-10 flex flex-col overflow-y-auto overscroll-contain bg-gray-100 transition-transform starting:translate-x-full motion-reduce:transition-none",
          leaving && "translate-x-full",
        )}
        aria-labelledby={headingId}
        data-testid="detail"
        onTransitionEnd={(event) => {
          if (leaving && event.target === event.currentTarget) onBack();
        }}
      >
        <header
          ref={header}
          className="sticky top-0 z-10 flex items-center gap-4 border-b border-gray-300 bg-white p-4"
        >
          <button
            type="button"
            className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-gray-300 text-black transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-black"
            aria-label={_("Detail_Back")}
            onClick={back}
          >
            <IconChevronLeft className="size-4" aria-hidden />
          </button>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center gap-3">
              <Image
                className="size-5 shrink-0"
                src={subject?.logo?.id}
                placeholderSrc={placeholderLogoMainUrl}
                alt=""
                width={20}
                height={20}
              />
              <h1
                ref={heading}
                id={headingId}
                className="min-w-0 text-lg leading-normal font-bold wrap-anywhere text-black focus:outline-none"
                tabIndex={-1}
              >
                {name}
              </h1>
            </div>
            <OrganizationFacts organization={organization} />
          </div>
        </header>
        <div className="flex flex-col gap-8 px-4 py-6">
          {groups.length > 0 && (
            <section className="flex flex-col gap-4">
              <h2 className="text-base font-medium text-black">
                {_("Detail_ThirdPartyVerification")}
              </h2>
              <ul className="flex flex-col gap-8 rounded-xl bg-white p-4">
                {groups.map((group) => (
                  <li key={group.issuer.id}>
                    <AnnotationGroupView group={group} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {links.length > 0 && (
            <section className="flex flex-col gap-4">
              <h2 className="text-base font-medium text-black">
                {_("Detail_PublishedPolicies")}
              </h2>
              <ul className="flex flex-col gap-1.5 rounded-2xl bg-white p-4">
                {links.map(({ id, name }, index) => (
                  <li key={index} className="flex">
                    <ExternalLink href={id}>{name}</ExternalLink>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <footer className="flex justify-center">
            <a
              className="text-xs text-gray-600 underline underline-offset-2"
              href={aboutUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              {_("Detail_AboutThisTool")}
              <span className="sr-only">{_("Link_OpensInNewTab")}</span>
            </a>
          </footer>
        </div>
      </section>
    </>
  );
}
