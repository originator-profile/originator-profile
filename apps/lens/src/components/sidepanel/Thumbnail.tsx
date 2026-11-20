import { useState } from "react";

/** サムネイルの寸法 */
const size = { width: 56, height: 56 };

/**
 * コンテンツのサムネイル
 *
 * 読み込めなければ何も表示しない。プレースホルダーは出さない
 */
export function Thumbnail({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      className="shrink-0 rounded-md object-cover"
      style={size}
      src={src}
      alt=""
      crossOrigin="anonymous"
      onError={() => setFailed(true)}
      {...size}
    />
  );
}
