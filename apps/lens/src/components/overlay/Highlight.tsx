import type { FrameCasCoordinate } from "@originator-profile/extension-common";
import type { Target } from "@originator-profile/model";
import { useEffect } from "react";
import { useWindowSize } from "react-use";
import type { Highlight, HighlightLabel } from "../../overlay/protocol";
import { useFrameCaRects } from "../frameCas/use-frame-ca-rects";
import { useLocatedCasCoordinate } from "../frameCas/use-located-cas-coordinate";
import { HighlightTag } from "./HighlightTag";
import useElements from "./use-elements";
import useRect from "./use-rect";

/** 強調する矩形と、その上に添えるタグ */
function Area({ rect, label }: { rect: DOMRect; label?: HighlightLabel }) {
  return (
    <>
      <div
        className="absolute rounded-[2px] border-[1.5px] border-primary-700 bg-primary-700/12 transition-opacity starting:opacity-0"
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
          className="absolute -translate-x-1/2 -translate-y-full pb-2 transition-opacity starting:opacity-0"
          style={{
            top: Math.max(rect.top, 40),
            left: rect.left + rect.width / 2,
          }}
        >
          <HighlightTag label={label} />
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
  return <Area rect={new DOMRect(0, 0, width, height)} label={label} />;
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
