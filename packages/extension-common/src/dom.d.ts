// Speculation Rules のプリレンダリング（TypeScript の DOM 型定義に含まれない）
// see https://wicg.github.io/nav-speculation/prerendering.html
interface Document {
  /** Chromium 以外では未定義 */
  readonly prerendering?: boolean;
}
