/** サムネイルの寸法 */
const size = { width: 84, height: 56 };

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
      className="shrink-0 rounded-md object-cover"
      style={size}
      src={src}
      alt=""
      crossOrigin="anonymous"
      onError={onError}
      {...size}
    />
  );
}
