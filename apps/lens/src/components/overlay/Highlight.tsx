import type { FrameCasCoordinate } from "@originator-profile/extension-common";
import type { Target } from "@originator-profile/model";
import { useEffect } from "react";
import { useWindowSize } from "react-use";
import { twMerge } from "tailwind-merge";
import type { Highlight, HighlightLabel } from "../../overlay/protocol";
import { useFrameCaRects } from "../frameCas/use-frame-ca-rects";
import { useLocatedCasCoordinate } from "../frameCas/use-located-cas-coordinate";
import { HighlightTag } from "./HighlightTag";
import useElements from "./use-elements";
import useRect from "./use-rect";

/**
 * 強調する矩形と、そこに添えるタグ
 *
 * コンテンツは塗りと枠で範囲を示し、タグを範囲の上に置く。ページ全体は枠だけで
 * 囲み、タグを枠の内側の上端に置く
 */
function Area({
  rect,
  label,
  page = false,
}: {
  rect: DOMRect;
  label?: HighlightLabel;
  page?: boolean;
}) {
  return (
    <>
      <div
        className={twMerge(
          "absolute rounded-[2px] border-[1.5px] border-primary-700 transition-opacity starting:opacity-0",
          !page && "bg-primary-700/12",
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
        <div
          className={twMerge(
            "absolute -translate-x-1/2 transition-opacity starting:opacity-0",
            page ? "pt-2" : "-translate-y-full pb-2",
          )}
          style={{
            top: page ? rect.top : Math.max(rect.top, 40),
            left: rect.left + rect.width / 2,
          }}
        >
          <HighlightTag label={label} placement={page ? "inside" : "above"} />
        </div>
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
}: {
  coordinate: FrameCasCoordinate;
  label?: HighlightLabel;
}) {
  const [ca] = cas;
  const rects = useFrameCaRects(frame, ca ?? { id: "", target: [] });
  return rects.map((rect, index) => (
    <Area key={index} rect={rect} label={index === 0 ? label : undefined} />
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
  if (isLocating || !coordinate) return null;
  return <FrameContentAreas coordinate={coordinate} label={label} />;
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
