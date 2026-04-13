# プロジェクト構造

## Feature-Driven Folder Structure

機能（Feature）ごとにファイルをまとめる構造を採用しています。

> [!NOTE]
> hooks, utils ディレクトリは機能別ディレクトリに移行予定です。新規の hooks や utils は機能フォルダ内に配置してください。
> Issue: [components, utils, hooks ディレクトリを機能ディレクトリに集約する (機能駆動的な構成であることを明確にする) · Issue #219 · originator-profile/originator-profile](https://github.com/originator-profile/originator-profile/issues/219)

### 基本原則

- **関連するファイルを近くに配置**: コンポーネント、フック、型、ユーティリティを同じディレクトリに
- **機能の独立性**: 各機能フォルダは独立して理解・修正できる
- **index.ts でエクスポート**: 外部公開する API を明示的に定義

## コンポーネントの分類

React コンポーネントは粒度と責務に基づいて3つに分類しています。この分類は [Atomic Design](https://atomicdesign.bradfrost.com/chapter-2/#atomic-design-is-for-user-interfaces) の UI 粒度に基づく分類を参考にしています。

| 分類                       | 責務                                                                                                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ページコンポーネント       | ルーティングから画面を初期化し、テンプレートコンポーネントの動作に必要なデータを用意する。必要なデータが用意できない場合は、原因に応じてエラーを通知する。 |
| テンプレートコンポーネント | 画面（拡張機能の場合はポップアップウィンドウ）の粒度の見た目と振る舞いを提供する。                                                                         |
| コンポーネント             | 画面未満の再利用可能な粒度の見た目と振る舞いを提供する。                                                                                                   |

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
├── templates/                   # テンプレートコンポーネント
│   ├── DetailInfo.tsx
│   ├── Org.tsx
│   └── Prohibition.tsx
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

> [!NOTE]
> 本プロジェクトの構造では、再帰的なエクスポートが頻出するため、
> 再エクスポートが容易な名前つきエクスポートを推奨します。

### 機能フォルダの index.ts

```typescript
// packages/ui/src/components/profileAnnotation/index.ts
export * from "./CertificateDetail";
export * from "./CertificateSummary";
export * from "./use-profile-annotator-wmp";
```

### パッケージの index.ts

```typescript
// packages/ui/src/index.ts
export * from "./components";
export * from "./utils";
```
