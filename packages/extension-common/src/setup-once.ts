/**
 * content script のセットアップを、同じ実行環境で 1 度だけおこなう
 *
 * NOTE: インストール時に既存のタブへ注入した content script は、そのとき
 * 読み込み中だったページではマニフェストによる注入と重なり、2 度実行される。
 * @param name content script の名前。注入されるファイルごとに分ける
 * @param setup セットアップ
 */
export function setupOnce(name: string, setup: () => void) {
  const key = Symbol.for(`originator-profile/content-script/${name}`);
  const scope = globalThis as Record<symbol, unknown>;
  if (scope[key]) return;
  scope[key] = true;
  setup();
}
