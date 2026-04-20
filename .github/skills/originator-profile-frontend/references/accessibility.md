# アクセシビリティガイドライン

次の文献を参考に実装します。

- [ARIA Authoring Practices Guide | APG | WAI | W3C](https://www.w3.org/WAI/ARIA/apg/)
- [WAI-ARIA Overview | Web Accessibility Initiative (WAI) | W3C](https://www.w3.org/WAI/standards-guidelines/aria/)

## メニューボタンの実装例

次の例は、[ARIA APG Menu Button Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/) に準拠してキーボードナビゲーションを実装しています。

```tsx
// apps/inspector/src/hooks/useMenuButton.ts
export function useMenuButton({ onItemSelect, items }: UseMenuButtonOptions) {
  // ...

  // ARIA 属性をオブジェクトとして返すことで、適用漏れを防ぐ
  return {
    buttonProps: {
      "aria-haspopup": "menu" as const,
      "aria-expanded": isOpen,
      "aria-controls": isOpen ? menuId : undefined,
    },
    menuProps: {
      role: "menu" as const,
      "aria-labelledby": buttonId,
    },
  };
}
```

**ポイント:**

- `aria-haspopup="menu"`: ボタンがメニューを開くことを支援技術に伝える
- `aria-expanded`: メニューの開閉状態を伝える
- `aria-controls`: ボタンが制御するメニュー要素を関連付ける
- `aria-labelledby`: メニューのラベルとしてボタンを参照する

## モーダルダイアログのフォーカス管理の実装例

次の例は、モーダル表示時に `inert` 属性を使用してフォーカスをダイアログ内に閉じ込めています。これにより、キーボードユーザーがダイアログ外の要素に誤ってフォーカスすることを防ぎます。

```tsx
// packages/ui/src/components/dialog/ModalDialog.tsx

// ダイアログ外の兄弟要素を非活性化する
function setInert(el: Node): () => void {
  const undos: Array<() => void> = [];

  crawlSiblingsUp(el, (sibling) => {
    sibling.inert = true;
    undos.push(() => (sibling.inert = false));
  });

  // クリーンアップ関数を返す
  return () => {
    while (undos.length) undos.pop()?.();
  };
}
```

**参考文献:** [aria-modal (property) | WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/#aria-modal)

## モーダルダイアログの ARIA 属性の実装例

```tsx
<div
  aria-modal
  aria-hidden={!isOpen}
  aria-labelledby={titleId}
  aria-describedby={descriptionId}
>
  <div role="dialog" tabIndex={0}>
    <h1 id={titleId}>タイトル</h1>
    <p id={descriptionId}>説明文</p>
  </div>
</div>
```

**ポイント:**

- `aria-modal`: モーダルであることを支援技術に伝える
- `aria-hidden`: 表示/非表示状態を伝える（CSS の `visibility` と連動）
- `aria-labelledby` / `aria-describedby`: ダイアログの目的を明確にする
