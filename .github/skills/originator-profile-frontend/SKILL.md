---
name: originator-profile-frontend
description: フロントエンド開発支援（React コンポーネント、Tailwind CSS、アクセシビリティ、テスト）
---

# Originator Profile フロントエンド開発ガイド

このスキルは、Originator Profile プロジェクトのフロントエンド開発を支援します。

## 技術スタック

- **フレームワーク**: React
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS + tailwind-merge
- **テスト**: Vitest（ユニット）、Playwright（E2E・VRT）
- **リンター**: ESLint
- **ビルド**: Vite、esbuild

## プロジェクト構成

```
apps/
├── web-ext/          # ブラウザ拡張機能
│   ├── src/
│   │   ├── components/   # Feature-driven 構造
│   │   ├── hooks/        # カスタムフック
│   │   ├── pages/        # ページコンポーネント
│   │   └── utils/        # ユーティリティ
│   └── e2e/              # E2E テスト
└── ...

packages/
├── ui/               # 共有 UI コンポーネント
│   └── src/
│       ├── components/
│       └── utils/
├── eslint-config/    # ESLint 設定
└── tailwind-config/  # Tailwind CSS 設定
```

## リファレンス

詳細なガイドラインは以下を参照してください：

- [コンポーネント作成パターン](./references/component-patterns.md) - Props 定義、スタイルマージ、命名規則
- [スタイリングガイド](./references/styling-guide.md) - Tailwind CSS による設計
- [アクセシビリティ](./references/accessibility.md) - ARIA APG 指向
- [テスト規約](./references/testing.md) - Vitest、Playwright、VRT
- [プロジェクト構造](./references/project-structure.md) - Feature-driven folder structure
