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
<Button className="bg-danger">削除</Button>
```

## clsx による条件付きスタイル

`clsx` は条件に基づいてクラス名を組み立てます。

```tsx
import clsx from "clsx";
import { twMerge } from "tailwind-merge";

function Button({ variant, isActive, className }: Props) {
  return (
    <button
      className={twMerge(
        clsx(
          "px-4 py-2 rounded",
          {
            "bg-primary text-white": variant === "primary",
            "bg-gray-200 text-gray-800": variant === "secondary",
            "ring-2 ring-primary": isActive,
          },
        ),
        className,
      )}
    />
  );
}
```

**使い分け:**
- `clsx`: 条件分岐でクラス名を組み立てる
- `twMerge`: Tailwind クラスの競合を解決する
- 両方使う場合は `clsx` を `twMerge` の中に入れる

## プロジェクトカラーパレット

`packages/tailwind-config/style.css` で定義されているカスタムカラー：

### Primary（プライマリ）
```css
--color-primary-50: #f8fdfd   /* 最も薄い */
--color-primary-100: #f1fbfb
--color-primary-200: #e6f8f8
--color-primary-300: #cceff0
--color-primary-400: #99dfe1
--color-primary-500: #66cfd2
--color-primary-600: #00afb4
--color-primary-700: #008488  /* メインカラー */
--color-primary-800: #006d73
--color-primary-900: #00585a
--color-primary-950: #003233  /* 最も濃い */
--color-primary: #008488
```

### セマンティックカラー

| 用途 | 変数 | 値 |
|------|------|-----|
| 成功（薄） | `--color-success-extralight` | #f7fee7 |
| 成功（明） | `--color-success-light` | #84cc16 |
| 成功 | `--color-success` | #65a30d |
| 注意（薄） | `--color-caution-extralight` | #fefce8 |
| 注意（明） | `--color-caution-light` | #fde047 |
| 注意 | `--color-caution` | #facc15 |
| 危険（薄） | `--color-danger-extralight` | #fef2f2 |
| 危険（明） | `--color-danger-light` | #f87171 |
| 危険 | `--color-danger` | #b80000 |
| レビュー | `--color-review` | var(--color-orange-700) |

### 使用例

```tsx
<div className="bg-primary text-white">プライマリ背景</div>
<div className="bg-success-extralight text-success">成功メッセージ</div>
<div className="bg-danger-extralight text-danger">エラーメッセージ</div>
```

## CSS ファイルの使用ケース

通常は Tailwind クラスを使用しますが、以下の場合は CSS ファイルを使います。

### 1. アニメーション（@starting-style）

```css
/* Menu.css */
.menu-container {
  display: none;
  opacity: 0;
  transform: scale(0.95);
  transition-property: display, opacity, transform;
  transition-duration: 100ms;
  transition-behavior: allow-discrete;
}

.menu-container[data-open="true"] {
  display: block;
  opacity: 1;
  transform: scale(1);

  @starting-style {
    opacity: 0;
    transform: scale(0.95);
  }
}
```

### 2. ベーススタイル

```css
/* style.css */
@layer base {
  dialog {
    margin: auto;
  }

  html:has([aria-modal][aria-hidden="false"]) {
    overflow: hidden;
  }
}
```

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

### CSS-first configuration

Tailwind CSS 4.x では CSS ファイルで設定を行います：

```css
@import "tailwindcss";
@import "@jumpu-ui/tailwindcss";
@plugin "@tailwindcss/typography";

@theme {
  --color-primary: #008488;
  /* ... */
}
```
