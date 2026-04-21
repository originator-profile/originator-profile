import { WebMediaProfile } from "@originator-profile/model";
import { Image } from "@originator-profile/ui";
import placeholderLogoMainUrl from "@originator-profile/ui/src/assets/placeholder-logo-main.png";
import { twMerge } from "tailwind-merge";

export function CaMarker(props: {
  className?: string;
  rect: DOMRect;
  active: boolean;
  onClick: () => void;
  wmp?: WebMediaProfile;
  filtered: boolean;
}) {
  const width = 54;
  const height = 54;
  const border = 4;
  const tailWidth = 30;
  const tailHeight = 12;
  const isTopOverflow = props.rect.top < height + border + tailHeight;

  const renderPolygon = () => {
    return (
      <svg
        viewBox={`0 0 ${tailWidth} ${tailHeight}`}
        width={tailWidth}
        height={tailHeight}
        className={twMerge(
          "absolute left-1/2 stroke-transparent -translate-x-1/2",
          isTopOverflow
            ? "top-0 -translate-y-full rotate-180"
            : "bottom-0 translate-y-full",
          props.active ? "fill-blue-500" : "fill-white",
        )}
      >
        <polygon points={`0,0 ${tailWidth / 2},${tailHeight} ${tailWidth},0`} />
      </svg>
    );
  };

  return (
    <div
      className={twMerge(
        props.className,
        "absolute transition-opacity",
        !props.filtered && "opacity-30",
      )}
      style={{
        top: isTopOverflow
          ? props.rect.top - border + tailHeight
          : props.rect.top - (height + border + tailHeight),
        left: props.rect.left - (width + border * 2) / 2,
      }}
    >
      <button
        className={twMerge(
          "relative rounded-sm",
          props.active ? "bg-blue-500" : "bg-white",
        )}
        title={props.wmp?.credentialSubject.name}
        onClick={props.onClick}
      >
        <Image
          className="border box-content rounded-sm border-gray-100 bg-white m-1"
          src={props.wmp?.credentialSubject.logo?.id}
          placeholderSrc={placeholderLogoMainUrl}
          alt={props.wmp?.credentialSubject.name ?? ""}
          width={width}
          height={height}
        />
        {renderPolygon()}
      </button>
    </div>
  );
}
