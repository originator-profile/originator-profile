import { KeyboardEvent, ReactNode, RefObject, useId, useRef } from "react";
import { twMerge } from "tailwind-merge";

/**
 * 兄弟ノードを探索する関数
 * @param el ノード
 * @param callback 兄弟ノードの HTML 要素に対するルーチン
 * @link https://yuheiy.com/2025-02-24-make-the-outside-inert
 * @link https://github.com/alpinejs/alpine/blob/e363181057b3e71e5c03d2b88db576d5094be1c8/packages/focus/src/index.js#L185-L195
 * @remarks
 * リンク先の文献を参考に実装しました。
 */
function crawlSiblingsUp(el: Node, callback: (el: HTMLElement) => void) {
  if (el === document.body || !el?.parentNode) return;

  for (const sibling of el.parentNode.children) {
    if (!(sibling instanceof HTMLElement)) continue;
    if (sibling === el) {
      crawlSiblingsUp(el.parentNode, callback);
    } else {
      callback(sibling);
    }
  }
}

/**
 * 兄弟ノードを非活性化する関数
 * @param el ノード
 * @returns 非活性化したノードを元に戻す関数
 * @link https://yuheiy.com/2025-02-24-make-the-outside-inert
 * @link https://github.com/alpinejs/alpine/blob/e363181057b3e71e5c03d2b88db576d5094be1c8/packages/focus/src/index.js#L169-L183
 * @remarks
 * リンク先の文献を参考に実装しました。
 */
function setInert(el: Node): () => void {
  const undos: Array<() => void> = [];

  crawlSiblingsUp(el, (sibling) => {
    sibling.inert = true;

    undos.push(() => (sibling.inert = false));
  });

  return () => {
    while (undos.length) undos.pop()?.();
  };
}

export type ModalDialogProps = {
  children:
    | ReactNode
    | ((props: {
        /** ダイアログのタイトルを示す要素に指定する識別子 */
        titleId: string;
        /** ダイアログの説明を示す要素に指定する識別子 */
        descriptionId: string;
      }) => ReactNode);
  className?: string;
  dialogRef: RefObject<HTMLDivElement | null>;
  /** モーダルダイアログを閉じるイベント。通常 useModalDialog().close を使用します。 */
  onClose(): void;
};

/**
 * @example
 * ```tsx
 * const dialog = useDialog();
 *
 * return (
 *   <>
 *     <button type="button" onClick={dialog.open}>open<button>
 *     <Dialog className="group-aria-hidden:translate-y-full bottom-0 translate-y-0" dialogRef={dialog.ref}>
 *       {({titleId, descriptionId}) => (
 *         <>
 *           <h1 id={titleId}>Title</h1>
 *           <p id={descriptionId}>Description</p>
 *         </>
 *       )}
 *     </Dialog>
 *   </>
 * );
 * ```
 */
export function useModalDialog() {
  const ref = useRef<HTMLDivElement>(null);
  const unsetInert = useRef<(() => void) | null>(null);
  const beforeActiveElement = useRef<Element | null>(null);

  function open() {
    const dialog = ref.current;
    if (!dialog) return;

    dialog.classList.remove("invisible");
    requestAnimationFrame(() => {
      dialog.ariaHidden = "false";
    });
    beforeActiveElement.current = document.activeElement;
    unsetInert.current = setInert(dialog);
    const focusableElement = dialog.querySelector<HTMLElement>(
      'a, button, [tabindex="0"]',
    );
    focusableElement?.focus();
  }

  async function close() {
    const dialog = ref.current;
    if (!dialog) return;

    // inert を先に解除してフォーカスを戻せるようにする
    unsetInert.current?.();
    unsetInert.current = null;

    // フォーカスを戻せる要素がある場合はそこに戻す
    if (beforeActiveElement.current instanceof HTMLElement) {
      beforeActiveElement.current.focus();
    } else if (
      document.activeElement instanceof HTMLElement &&
      dialog.contains(document.activeElement)
    ) {
      // ダイアログ内の要素にフォーカスがある場合のみ blur
      document.activeElement.blur();
    }
    beforeActiveElement.current = null;

    dialog.ariaHidden = "true";

    await new Promise((r) => {
      dialog.addEventListener("transitionend", r, { once: true });
    });

    dialog.classList.add("invisible");
  }

  return { ref, open, close };
}

/**
 * モーダルダイアログ
 *
 * 画面全体を占有して対話的なUIを表示します。
 * 表示時に次のように振る舞います。
 *
 * - ダイアログにフォーカスが当たるように制御します。
 * - モーダル外の要素はフォーカスできないように制御します。
 * - Escキーを押した際にダイアログが閉じられます。
 * - ダイアログより背部の要素へのクリックまたはEnterキーを押した際にダイアログが閉じられます。
 */
export function ModalDialog(props: ModalDialogProps) {
  const handleKeyDownEscape = (e: KeyboardEvent) =>
    e.key === "Escape" && props.onClose();
  const handleKeyDownEnter = (e: KeyboardEvent) =>
    e.key === "Enter" && props.onClose();
  const elementId = useId();
  const titleId = `${elementId}-title`;
  const descriptionId = `${elementId}-description`;

  return (
    <div
      /* oxlint-disable-next-line react/react-compiler */
      ref={props.dialogRef}
      aria-modal
      aria-hidden
      /* oxlint-disable-next-line react/react-compiler */
      {...(typeof props.children === "function"
        ? { "aria-labelledby": titleId, "aria-describedby": descriptionId }
        : null)}
      className={twMerge(
        "aria-hidden:opacity-0",
        "duration-300",
        "ease-in-out",
        "fixed",
        "group",
        "h-dvh",
        "inset-0",
        "invisible",
        "transition-opacity",
        "w-dvw",
        "z-[calc(infinity)]",
      )}
      onKeyDown={handleKeyDownEscape}
    >
      <div
        role="dialog"
        className={twMerge(
          "absolute",
          "duration-300",
          "max-h-full",
          "max-w-full",
          "transition-transform",
          "z-1",
          /* oxlint-disable-next-line react/react-compiler */
          props.className,
        )}
        tabIndex={0}
      >
        {/* oxlint-disable react/react-compiler */}
        {typeof props.children === "function"
          ? props.children({ titleId, descriptionId })
          : props.children}
      </div>
      {/* oxlint-enable react/react-compiler */}
      <div
        role="button"
        onClick={() => props.onClose()}
        onKeyDown={handleKeyDownEnter}
        className={twMerge("bg-black/25", "h-full", "inset-0", "w-full")}
        tabIndex={0}
        aria-label="Close"
      />
    </div>
  );
}
