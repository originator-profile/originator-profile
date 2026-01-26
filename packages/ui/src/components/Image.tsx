import { twMerge } from "tailwind-merge";

type Props = {
  className?: string;
  src?: string;
  placeholderSrc: string;
  alt: string;
  width: number;
  height: number;
  cover?: boolean;
};

const isJa = () => {
  const locale = navigator.language || "en";
  return locale.startsWith("ja");
};

const getDocumentLink = () => {
  return `https://docs.originator-profile.org/${isJa() ? "ja" : "en"}/troubleshooting/image-access-error/`;
};

const documentLink = getDocumentLink();

function Image({
  className,
  src,
  placeholderSrc,
  alt,
  width,
  height,
  cover = false,
}: Props) {
  return (
    <figure
      className={twMerge(
        "flex justify-center items-center overflow-hidden",
        className,
      )}
      style={{ height, minWidth: width }}
    >
      <img
        className={twMerge("w-auto", cover ? "object-cover" : "object-contain")}
        style={
          cover ? { width, height } : { maxWidth: width, maxHeight: height }
        }
        src={src ?? placeholderSrc}
        alt={alt}
        width={width}
        height={height}
        crossOrigin="anonymous"
        onError={(e) => {
          const message = isJa()
            ? `[Originator Profile] 画像の読み込みに失敗しました: ${e.currentTarget.src}\n対処法: ${documentLink}`
            : `[Originator Profile] Failed to load image: ${e.currentTarget.src}\nTroubleshooting: ${documentLink}`;
          console.error(message);
        }}
      />
    </figure>
  );
}

export default Image;
