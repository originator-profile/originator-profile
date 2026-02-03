# アクセシビリティガイドライン

## ARIA 属性の使用例

### メニューボタン

```tsx
// ボタン側
const buttonProps = {
  "aria-haspopup": "menu" as const,
  "aria-expanded": isOpen,
  "aria-controls": isOpen ? menuId : undefined,
  id: buttonId,
};

// メニュー側
const menuProps = {
  role: "menu" as const,
  "aria-labelledby": buttonId,
  id: menuId,
};

// メニューアイテム
<button role="menuitem">アイテム</button>
```

### モーダルダイアログ

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

**重要なポイント:**
- `aria-modal`: モーダルであることを示す
- `aria-hidden`: 表示/非表示状態を示す
- `aria-labelledby`: タイトル要素を関連付け
- `aria-describedby`: 説明要素を関連付け

## キーボードナビゲーション

### メニューのキーボード操作

```tsx
const handleMenuKeyDown = (event: React.KeyboardEvent, itemValue: string) => {
  switch (event.key) {
    case "Enter":
    case " ":
      event.preventDefault();
      selectItem(itemValue);
      break;
    case "ArrowDown":
      event.preventDefault();
      focusNextItem();
      break;
    case "ArrowUp":
      event.preventDefault();
      focusPrevItem();
      break;
    case "Home":
      event.preventDefault();
      focusFirstItem();
      break;
    case "End":
      event.preventDefault();
      focusLastItem();
      break;
    case "Escape":
      event.preventDefault();
      closeMenu();
      break;
    case "Tab":
      // Tab は自然にフォーカスを移動させる
      closeMenu();
      break;
  }
};
```

### 必須のキーボード操作

| コンポーネント | キー | 動作 |
|--------------|------|------|
| ボタン | Enter, Space | クリック |
| メニュー | ArrowDown/Up | 次/前のアイテム |
| メニュー | Home/End | 最初/最後のアイテム |
| ダイアログ | Escape | 閉じる |

## フォーカス管理

### inert 属性によるフォーカストラップ

モーダルダイアログ表示中は、モーダル外の要素を `inert` にしてフォーカスを閉じ込めます。

```tsx
// 兄弟ノードを非活性化する
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
```

### フォーカス復帰

ダイアログを閉じる際は、開く前にフォーカスがあった要素にフォーカスを戻します。

```tsx
const beforeActiveElement = useRef<Element | null>(null);

function open() {
  beforeActiveElement.current = document.activeElement;
  // ダイアログを開く処理
}

function close() {
  if (beforeActiveElement.current instanceof HTMLElement) {
    beforeActiveElement.current.focus();
  }
  beforeActiveElement.current = null;
}
```

### モーダル表示時のスクロール制御

```css
html:has([aria-modal][aria-hidden="false"]) {
  overflow: hidden;
}
```

## ESLint jsx-a11y ルール

プロジェクトでは `eslint-plugin-jsx-a11y` が有効になっています。

### 主要なルール

```javascript
// eslint.config.mjs
jsxA11y.flatConfigs.recommended,
{
  rules: {
    // dialog 要素には tabIndex を許可
    "jsx-a11y/no-noninteractive-tabindex": ["error", { roles: ["dialog"] }],
  },
}
```

### よくある警告と対処法

| 警告 | 対処法 |
|------|--------|
| `click-events-have-key-events` | `onKeyDown` でキーボード操作を追加 |
| `no-static-element-interactions` | `role` 属性を追加（例: `role="button"`） |
| `anchor-is-valid` | `href` を適切に設定するか `button` を使用 |
| `label-has-associated-control` | `<label htmlFor="...">` を使用 |

### アクセシブルなボタン代替

```tsx
// 非インタラクティブ要素をインタラクティブにする場合
<div
  role="button"
  onClick={handleClick}
  onKeyDown={(e) => e.key === "Enter" && handleClick()}
  tabIndex={0}
  aria-label="閉じる"
>
  ×
</div>
```
