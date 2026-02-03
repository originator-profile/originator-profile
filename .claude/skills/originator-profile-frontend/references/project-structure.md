# プロジェクト構造

## Feature-Driven Folder Structure

機能（Feature）ごとにファイルをまとめる構造を採用しています。

### 基本原則

- **関連するファイルを近くに配置**: コンポーネント、フック、型、ユーティリティを同じディレクトリに
- **機能の独立性**: 各機能フォルダは独立して理解・修正できる
- **index.ts でエクスポート**: 外部公開する API を明示的に定義

### apps/web-ext の構造

```
apps/web-ext/src/
├── components/
│   ├── Menu/                    # メニュー機能
│   │   ├── Menu.tsx
│   │   ├── Menu.css
│   │   ├── MenuButton.tsx
│   │   ├── MenuItem.tsx
│   │   └── index.ts             # エクスポート定義
│   │
│   ├── credentials/             # 認証情報機能
│   │   ├── Credentials.tsx
│   │   ├── use-credentials.ts
│   │   ├── types.ts
│   │   ├── errors.ts
│   │   ├── README.md            # 機能ドキュメント
│   │   └── index.ts
│   │
│   ├── overlay/                 # オーバーレイ機能
│   │   ├── CaMarker.tsx
│   │   ├── use-elements.ts
│   │   ├── use-rect.ts
│   │   └── index.ts
│   │
│   └── siteProfile/             # サイトプロファイル機能
│       ├── SiteProfile.tsx
│       ├── use-site-profile.ts
│       ├── types.ts
│       └── index.ts
│
├── hooks/                       # 共有フック
│   └── useMenuButton.ts
│
├── pages/                       # ページコンポーネント
│   ├── Base.tsx
│   ├── Credentials.tsx
│   └── SiteProfile.tsx
│
└── utils/                       # 共有ユーティリティ
    ├── get-profile-error-message.ts
    └── get-registry-keys.ts
```

### packages/ui の構造

```
packages/ui/src/
├── components/
│   ├── Header.tsx               # 単体コンポーネント
│   ├── Spinner.tsx
│   ├── Table.tsx
│   │
│   ├── dialog/                  # ダイアログ機能
│   │   ├── ModalDialog.tsx
│   │   └── index.ts
│   │
│   ├── link/                    # リンク機能
│   │   ├── ExternalLink.tsx
│   │   ├── README.md
│   │   └── index.ts
│   │
│   └── index.ts                 # 全コンポーネントのエクスポート
│
├── utils/
│   ├── get-message.ts
│   ├── sort-certificates.ts
│   ├── sort-certificates.test.ts
│   └── index.ts
│
└── index.ts                     # パッケージエントリポイント
```

## モジュールエクスポートパターン

### 機能フォルダの index.ts

```typescript
// components/Menu/index.ts
export { useMenuButton } from "../../hooks/useMenuButton";
export { Menu } from "./Menu";
export { MenuButton } from "./MenuButton";
export { MenuItem } from "./MenuItem";
```

### パッケージの index.ts

```typescript
// packages/ui/src/index.ts
export * from "./components";
export * from "./utils";
```

## ESLint による品質制約

### 複雑度の制限

```javascript
// eslint.config.mjs
{
  rules: {
    "max-depth": ["error", 2],      // ネスト深さ最大 2
    complexity: ["error", 10],       // 循環的複雑度最大 10
  },
}
```

### max-depth: 2

```tsx
// NG: 深さ 3
function Component() {
  if (condition1) {
    if (condition2) {
      if (condition3) {  // エラー
        return <div />;
      }
    }
  }
}

// OK: 早期リターンで深さを抑える
function Component() {
  if (!condition1) return null;
  if (!condition2) return null;
  if (!condition3) return null;
  return <div />;
}
```

### complexity: 10

複雑な条件分岐が多い場合は、関数を分割します。

```tsx
// NG: 複雑度が高い
function handleKeyDown(event: KeyboardEvent) {
  switch (event.key) {
    case "Enter": /* ... */ break;
    case " ": /* ... */ break;
    case "ArrowDown": /* ... */ break;
    // ... 多数のケース
  }
}

// OK: ハンドラを分離
const keyHandlers = {
  Enter: handleEnter,
  " ": handleSpace,
  ArrowDown: handleArrowDown,
};

function handleKeyDown(event: KeyboardEvent) {
  keyHandlers[event.key]?.();
}
```

## ファイル命名規則

| 種類 | パターン | 例 |
|------|---------|-----|
| React コンポーネント | PascalCase.tsx | `Header.tsx`, `MenuButton.tsx` |
| カスタムフック | kebab-case.ts | `use-menu-button.ts` |
| ユーティリティ | kebab-case.ts | `get-message.ts` |
| 型定義 | kebab-case.ts | `types.ts` |
| テスト | *.test.ts | `is-frame-visible.test.ts` |
| CSS | 対応コンポーネント名.css | `Menu.css` |
| ドキュメント | README.md | 各機能フォルダ内 |

## 機能ドキュメント

各機能フォルダには `README.md` を配置して、機能の概要を記述できます。

```markdown
<!-- components/credentials/README.md -->
# Credentials

認証情報の取得と検証を行う機能です。

## 使い方

...
```
