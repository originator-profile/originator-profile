/** コンテンツのサムネイル。読み込めなければ onError で知らせる */
export function Thumbnail({
  src,
  onError,
}: {
  src: string;
  onError: () => void;
}) {
  return (
    <img
      className="h-14 w-21 shrink-0 rounded-md object-cover"
      src={src}
      alt=""
      crossOrigin="anonymous"
      onError={onError}
      width={84}
      height={56}
    />
  );
}
