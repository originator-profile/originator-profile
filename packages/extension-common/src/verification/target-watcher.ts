import type { Target } from "@originator-profile/model";
import {
  TargetIntegrityAlgorithm,
  targetInputDependency,
} from "@originator-profile/verify";

/** 検証した target と、そのとき選択された要素 */
type Watched = { content: Target; elements: readonly Element[] };

const select = (content: Target) =>
  TargetIntegrityAlgorithm[content.type].elementSelector({
    ...content,
    document,
  });

const isSameSelection = (a: readonly Element[], b: readonly Element[]) =>
  a.length === b.length && a.every((element, i) => element === b[i]);

/**
 * 検証済みの target の入力依存対象の変化を監視する
 *
 * 入力依存対象を求め直す代わりに、次の変化の検知で近似する。
 * - parsed DOM: CSS セレクターに一致する要素の集合の変化と、一致した要素の部分木の変化
 * - rendered result: parsed DOM と同じ変化に加え、要素とビューポートの大きさの変化。
 *   rendered result に依存する type は非推奨のため、文書の可視性の変化は監視しない
 *
 * DOM の変化は、文書を監視する MutationObserver の記録を {@link handleMutations}
 * に渡して判定する。
 * @param onChange 変化を検知したときに 1 度だけ呼ばれる。監視はそこで止まる
 */
export function createTargetWatcher(onChange: () => void) {
  let watched: Watched[] = [];
  let cleanups: (() => void)[] = [];

  const reset = () => {
    for (const cleanup of cleanups) cleanup();
    cleanups = [];
    watched = [];
  };

  const changed = () => {
    if (watched.length === 0) return;
    reset();
    onChange();
  };

  /** rendered result に依存する target の、レイアウトの変化を監視する */
  const watchLayout = (elements: readonly Element[]) => {
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
    window.addEventListener("resize", changed);
    cleanups.push(() => {
      resize.disconnect();
      window.removeEventListener("resize", changed);
    });
  };

  /** 検証した target を監視に加える */
  const watch = (content: Target) => {
    const elements = select(content);
    if (elements.length === 0) return;
    watched.push({ content, elements });
    if (targetInputDependency[content.type] === "rendered-result") {
      watchLayout(elements);
    }
  };

  /** 文書の変化が、監視中の target の入力依存対象を変えたか判定する */
  const handleMutations = (records: MutationRecord[]) => {
    if (watched.length === 0) return;
    const elements = watched.flatMap((w) => w.elements);
    const inside = (node: Node) =>
      elements.some((element) => element.contains(node));
    const touched = records.some(
      ({ target, removedNodes }) =>
        inside(target) ||
        [...removedNodes].some((node) =>
          elements.some((element) => node.contains(element)),
        ),
    );
    if (touched) return changed();

    // NOTE: 一致する要素は文書のルート要素から検索されるため、部分木の外の変化でも
    // 一致する要素の集合が変わりうる
    const restructured = records.some(({ type }) => type !== "characterData");
    if (
      restructured &&
      watched.some(
        ({ content, elements }) => !isSameSelection(select(content), elements),
      )
    ) {
      changed();
    }
  };

  return { watch, reset, handleMutations };
}
