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

## コンポーネントは自身より外側に影響を与えるスタイルをデフォルトで持たない

コンポーネントの outer element に `margin` などの外部に影響を与えるプロパティをデフォルトで設定しない。余白の制御は親要素が行う。

```tsx
// 良い例: デフォルトでは margin を持たず、親が余白を制御
function Card({ className, children }: Props) {
  return (
    <div className={twMerge("p-4 rounded border", className)}>{children}</div>
  );
}

// 親が props 経由で margin を指定
<Card className="mb-4" />

// あるいは、親が gap などの子要素に影響を与える CSS プロパティで制御
<div className="flex flex-col gap-4">
  <Card />
  <Card />
</div>

// 悪い例: コンポーネント内部でデフォルトの margin を設定
function Card({ className, children }: Props) {
  return (
    <div className={twMerge("p-4 rounded border mb-4", className)}>
      {children}
    </div>
  );
}
```

**理由:**

- デフォルトの margin は外部に影響し再利用性が低下
- 親で制御することでレイアウト責務が明確
- gap で一貫した間隔を保てる

**適用範囲:** ブロックレベルのコンポーネントに適用。`<strong>`, `<em>`, `<code>` 等のインライン要素は対象外。

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
