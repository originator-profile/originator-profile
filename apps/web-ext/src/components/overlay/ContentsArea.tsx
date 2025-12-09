import { Target } from "@originator-profile/model";
import { useId } from "react";
import { useWindowSize } from "react-use";
import { useAbsoluteRects } from "../frameCas/use-absolute-rects";
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

type Props = {
  className?: string;
  contents: Target[];
};

export function ContentsArea(props: Props) {
  const { width, height } = useWindowSize();
  const { frameCasCoordinate } = useLocatedCasCoordinate();
  const { elements } = useElements(props.contents);
  const id = useId();

  const absoluteTargets =
    frameCasCoordinate?.cas.flatMap((ca) => ca.target) ?? [];

  const absoluteRects = useAbsoluteRects(
    frameCasCoordinate?.ancestor ?? [],
    {
      scrollX: frameCasCoordinate?.scrollX ?? 0,
      scrollY: frameCasCoordinate?.scrollY ?? 0,
    },
    absoluteTargets,
  );

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
          {absoluteRects.map((rect, index) => (
            <rect
              key={`absolute-${index}`}
              className="fill-black"
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
            />
          ))}
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
      {absoluteRects.map((rect, index) => (
        <rect
          key={`absolute-${index}`}
          className="fill-transparent stroke-[#bc15ac] stroke-1"
          x={rect.x}
          y={rect.y}
          width={rect.width}
          height={rect.height}
          strokeDasharray="4"
        />
      ))}
    </svg>
  );
}
