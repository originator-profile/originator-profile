# コンポーネント作成パターン

## Props 定義パターン

コンポーネントの Props は `type Props` で定義し、`className` をオプションで受け取ります。

```tsx
import { twMerge } from "tailwind-merge";

type Props = {
  className?: string;
  children: React.ReactNode;
};

function Header({ className, children }: Props) {
  return (
    <header
      className={twMerge(
        "px-3 py-2 bg-white border-b border-gray-300 flex items-center gap-1",
        className,
      )}
    >
      {children}
    </header>
  );
}

export default Header;
```

**ポイント:**

- `type Props` を使用（`interface` ではなく）
- `className` はオプショナルで、`twMerge` でマージ
- デフォルトスタイルを先に、外部から渡された `className` を後に

## ファイル命名規則

ESLint の `canonical/filename-match-exported` ルールにより、ファイル名はエクスポート名に対応する必要があります。

| 種類           | ファイル名                        | エクスポート名     |
| -------------- | --------------------------------- | ------------------ |
| コンポーネント | `Header.tsx` (PascalCase)         | `Header`           |
| フック         | `use-menu-button.ts` (kebab-case) | `useMenuButton`    |
| ユーティリティ | `get-message.ts` (kebab-case)     | `getMessage`       |
| 定数           | `constants.ts` (kebab-case)       | 複数エクスポート可 |

## カスタムフックの分離

複雑なロジックはカスタムフックに分離します。

```tsx
// hooks/useMenuButton.ts
export function useMenuButton({ onItemSelect, items }: UseMenuButtonOptions) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // フォーカス管理
  const focusButton = useCallback(() => {
    buttonRef.current?.focus();
  }, []);

  // ARIA 属性をまとめて返す
  return {
    isOpen,
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

## モジュールエクスポートパターン

Feature フォルダでは `index.ts` でエクスポートをまとめます。

```ts
// components/Menu/index.ts
export { useMenuButton } from "../../hooks/useMenuButton";
export { Menu } from "./Menu";
export { MenuButton } from "./MenuButton";
export { MenuItem } from "./MenuItem";
```

## Render Props パターン

動的なコンテンツには Render Props を使用します。

```tsx
type ModalDialogProps = {
  children:
    | ReactNode
    | ((props: { titleId: string; descriptionId: string }) => ReactNode);
};

// 使用例
<ModalDialog dialogRef={dialog.ref}>
  {({ titleId, descriptionId }) => (
    <>
      <h1 id={titleId}>タイトル</h1>
      <p id={descriptionId}>説明文</p>
    </>
  )}
</ModalDialog>;
```
