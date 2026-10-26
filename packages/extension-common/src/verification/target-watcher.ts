import type { Target } from "@originator-profile/model";
import {
  TargetIntegrityAlgorithm,
  targetInputDependency,
} from "@originator-profile/verify";

/**
 * 検証済みの target の入力依存対象の変化を監視する
 *
 * NOTE: 監視するのは検証時に選択された要素だけで、後から挿入されてセレクターに
 * 一致するようになった要素は検知しない。
 * @param onChange 変化を検知したときに 1 度だけ呼ばれる。監視はそこで止まる
 */
export function createTargetWatcher(onChange: () => void) {
  const watched = new Set<Element>();
  let observers: { disconnect(): void }[] = [];

  const reset = () => {
    for (const observer of observers) observer.disconnect();
    observers = [];
    watched.clear();
  };

  const changed = () => {
    if (watched.size === 0) return;
    reset();
    onChange();
  };

  /** 検証した target の要素を監視に加える */
  const watch = (content: Target) => {
    const elements = TargetIntegrityAlgorithm[content.type].elementSelector({
      ...content,
      document,
    });
    if (elements.length === 0) return;

    const mutation = new MutationObserver(changed);
    for (const element of elements) {
      mutation.observe(element, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
      });
      watched.add(element);
    }
    observers.push(mutation);

    if (targetInputDependency[content.type] === "rendered-result") {
      // NOTE: ResizeObserver は監視を始めた時点の大きさを最初に通知する
      let initial = true;
      const resize = new ResizeObserver(() => {
        if (initial) {
          initial = false;
          return;
        }
        changed();
      });
      for (const element of elements) resize.observe(element);
      observers.push(resize);
    }
  };

  /** 文書から取り除かれたノードが監視中の要素を含めば、変化として扱う */
  const handleRemoved = (nodes: Iterable<Node>) => {
    const removed = [...nodes];
    const isRemoved = (element: Element) =>
      removed.some((node) => node.contains(element));
    if ([...watched].some(isRemoved)) changed();
  };

  return { watch, reset, handleRemoved };
}
