# スタイリングガイド

## tailwind-merge の使い方

`tailwind-merge` は競合する Tailwind クラスを適切にマージします。コンポーネントの `className` プロパティを受け取る際に使用します。

```tsx
import { twMerge } from "tailwind-merge";

function Button({ className, children }: Props) {
  return (
    <button
      className={twMerge(
        // デフォルトスタイル
        "px-4 py-2 bg-primary text-white rounded",
        // 外部から渡されたクラス（上書き可能）
        className,
      )}
    >
      {children}
    </button>
  );
}

// 使用例: bg-primary が bg-danger に上書きされる
<Button className="bg-danger">削除</Button>;
```

> [!NOTE]
> clsx を使用している箇所は tailwind-merge へ移行予定です。新規コードでは `twMerge` を使用してください。
> Issue: [clsx の代わりに tailwind-merge を導入する提案 · Issue #45 · originator-profile/originator-profile](https://github.com/originator-profile/originator-profile/issues/45)

## プロジェクト設定

`packages/tailwind-config/style.css` を参照します。

## Tailwind CSS 4.x の注意点

### ボーダー色のデフォルト変更

Tailwind CSS v4 ではボーダー色のデフォルトが `currentcolor` に変更されました。v3 互換のため、プロジェクトでは以下の設定を追加しています：

```css
@layer base {
  *,
  ::after,
  ::before,
  ::backdrop,
  ::file-selector-button {
    border-color: var(--color-gray-300);
  }
}
```
