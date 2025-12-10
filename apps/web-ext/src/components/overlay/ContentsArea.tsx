import { Target } from "@originator-profile/model";
import { useId } from "react";
import { useWindowSize } from "react-use";
import { twMerge } from "tailwind-merge";
import { CaCoordinate, FrameCoordinate } from "../frameCas/types";
import { useFrameCaRects } from "../frameCas/use-frame-ca-rects";
import { useLocatedCasCoordinate } from "../frameCas/use-located-cas-coordinate";
import useElements from "./use-elements";
import useRect from "./use-rect";

function ElementRect({
  element,
  className,
  ...props
}: {
  element: HTMLElement;
  className?: string;
} & React.SVGAttributes<SVGRectElement>) {
  const { rect } = useRect(element);
  if (!rect) return null;
  return (
    <rect
      className={className}
      x={rect.x}
      y={rect.y}
      width={rect.width}
      height={rect.height}
      {...props}
    />
  );
}

function FrameRect({
  frame,
  ca,
  className,
  ...props
}: {
  frame: FrameCoordinate;
  ca: CaCoordinate;
  className?: string;
} & React.SVGAttributes<SVGRectElement>) {
  const rects = useFrameCaRects(frame, ca);
  return (
    <>
      {rects.map((rect, index) => (
        <rect
          key={`${frame.frameId}-${ca.id}-${index}`}
          className={className}
          x={rect.x}
          y={rect.y}
          width={rect.width}
          height={rect.height}
          {...props}
        />
      ))}
    </>
  );
}

type Props = {
  className?: string;
  contents: Target[];
};

export function ContentsArea(props: Props) {
  const { width, height } = useWindowSize();
  const { framesCasCoordinate, isLocating } = useLocatedCasCoordinate();
  const { elements } = useElements(props.contents);
  const id = useId();

  return (
    <svg
      className={props.className}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      data-testid="content-highlight"
    >
      <defs>
        <mask id={id}>
          <rect className="fill-white" x="0" y="0" width="100%" height="100%" />
          {elements.map((element, index) => (
            <ElementRect
              key={`element-${index}`}
              className="fill-black"
              element={element}
            />
          ))}
          {framesCasCoordinate.flatMap((frameCasCoordinate) =>
            frameCasCoordinate.cas.map((ca) => (
              <FrameRect
                key={`${frameCasCoordinate.frameId}-${ca.id}`}
                className={twMerge(
                  "transition transition-discrete fill-black starting:opacity-0",
                  isLocating ? "opacity-0 hidden" : "opacity-100",
                )}
                frame={frameCasCoordinate}
                ca={ca}
              />
            )),
          )}
        </mask>
      </defs>
      <rect
        className="fill-black/25"
        x="0"
        y="0"
        width="100%"
        height="100%"
        mask={`url(#${id})`}
      />
      {elements.map((element, index) => (
        <ElementRect
          key={`element-${index}`}
          className="fill-transparent stroke-[#bc15ac] stroke-1"
          element={element}
          strokeDasharray="4"
        />
      ))}
      {framesCasCoordinate.flatMap((frameCasCoordinate) =>
        frameCasCoordinate.cas.map((ca) => (
          <FrameRect
            key={`${frameCasCoordinate.frameId}-${ca.id}`}
            className={twMerge(
              "transition transition-discrete fill-transparent stroke-[#bc15ac] stroke-1 starting:opacity-0",
              isLocating ? "opacity-0 hidden" : "opacity-100",
            )}
            frame={frameCasCoordinate}
            ca={ca}
            strokeDasharray="4"
          />
        )),
      )}
    </svg>
  );
}
