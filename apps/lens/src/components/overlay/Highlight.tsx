import type { FrameCasCoordinate } from "@originator-profile/extension-common";
import type { Target } from "@originator-profile/model";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useWindowSize } from "react-use";
import { twMerge } from "tailwind-merge";
import type { Highlight, HighlightLabel } from "../../overlay/protocol";
import { useFrameCaRects } from "../frameCas/use-frame-ca-rects";
import { useLocatedCasCoordinate } from "../frameCas/use-located-cas-coordinate";
import { HighlightTag } from "./HighlightTag";
import { tagPositionOf } from "./tag-position";
import useElements from "./use-elements";
import useRect from "./use-rect";

/**
 * 表示の切り替え。サブフレームの位置を測り直す間は隠し、測り終えたら戻す
 * (inspector と同じ)
 */
const fade = (locating = false) =>
  twMerge(
    "transition transition-discrete starting:opacity-0",
    locating ? "hidden opacity-0" : "opacity-100",
  );

/** 範囲に添えるタグ。範囲と画面の大きさから置き場所を決める */
function Tag({
  rect,
  label,
  page,
  locating,
}: {
  rect: DOMRect;
  label: HighlightLabel;
  page: boolean;
  locating?: boolean;
}) {
  const viewport = useWindowSize();
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const tag = ref.current;
    if (tag) setSize({ width: tag.offsetWidth, height: tag.offsetHeight });
  }, [label.name, label.logo, label.country, page]);
  const { placement, top, left, tailX } = tagPositionOf(rect, viewport, size);
  const above = placement === "above";

  return (
    <div
      className={twMerge(
        "absolute z-10",
        above ? "-translate-y-full pb-2" : "pt-2",
        fade(locating),
      )}
      style={{ top, left }}
    >
      <HighlightTag
        ref={ref}
        label={label}
        direction={above ? "down" : "up"}
        tailX={tailX}
        large={page}
      />
    </div>
  );
}

/**
 * 強調する矩形と、そこに添えるタグ
 *
 * コンテンツは塗りと枠で範囲を示す。ページ全体は枠だけで囲む。タグは
 * 範囲より手前に描く
 */
function Area({
  rect,
  label,
  page = false,
  locating,
}: {
  rect: DOMRect;
  label?: HighlightLabel;
  page?: boolean;
  locating?: boolean;
}) {
  return (
    <>
      <div
        className={twMerge(
          "absolute rounded-[2px] border-[1.5px] border-primary-700",
          !page && "bg-primary-700/12",
          fade(locating),
        )}
        style={{
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        }}
        data-testid="highlight-area"
      />
      {label && (
        <Tag rect={rect} label={label} page={page} locating={locating} />
      )}
    </>
  );
}

function ElementArea({
  element,
  label,
}: {
  element: HTMLElement;
  label?: HighlightLabel;
}) {
  const { rect } = useRect(element);
  if (!rect) return null;
  return <Area rect={rect} label={label} />;
}

/** トップレベル文書のコンテンツ */
function PageContent({
  targets,
  label,
}: {
  targets: Target[];
  label?: HighlightLabel;
}) {
  const { elements } = useElements(targets);
  const [first] = elements;
  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    first?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "nearest",
    });
  }, [first]);
  return elements.map((element, index) => (
    <ElementArea
      key={index}
      element={element}
      label={index === 0 ? label : undefined}
    />
  ));
}

function FrameContentAreas({
  coordinate: { cas, ...frame },
  label,
  locating,
}: {
  coordinate: FrameCasCoordinate;
  label?: HighlightLabel;
  locating: boolean;
}) {
  const [ca] = cas;
  const rects = useFrameCaRects(frame, ca ?? { id: "", target: [] });
  return rects.map((rect, index) => (
    <Area
      key={index}
      rect={rect}
      label={index === 0 ? label : undefined}
      locating={locating}
    />
  ));
}

/** サブフレームのコンテンツ */
function FrameContent({
  frameId,
  label,
}: {
  frameId: number;
  label?: HighlightLabel;
}) {
  const { framesCasCoordinate, isLocating } = useLocatedCasCoordinate();
  const coordinate = framesCasCoordinate.find(
    (coordinate) => coordinate.frameId === frameId,
  );
  if (!coordinate) return null;
  return (
    <FrameContentAreas
      coordinate={coordinate}
      label={label}
      locating={isLocating}
    />
  );
}

/** ページ全体 */
function PageArea({ label }: { label: HighlightLabel }) {
  const { width, height } = useWindowSize();
  return <Area rect={new DOMRect(0, 0, width, height)} label={label} page />;
}

/** ページ上の強調 */
export function HighlightView({ highlight }: { highlight: Highlight }) {
  if (highlight.kind === "page") return <PageArea label={highlight.label} />;
  return highlight.frame.frameId === 0 ? (
    <PageContent targets={highlight.targets} label={highlight.label} />
  ) : (
    <FrameContent frameId={highlight.frame.frameId} label={highlight.label} />
  );
}
