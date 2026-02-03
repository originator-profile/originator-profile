# テスト規約

## Vitest によるユニットテスト

### テストファイルの配置

テストファイルはテスト対象と同じディレクトリに配置します。

```
components/
├── frameCas/
│   ├── is-frame-visible.ts
│   └── is-frame-visible.test.ts
└── rtb/
    ├── bidresponse.ts
    └── bidresponse.test.ts
```

### テストの書き方

```typescript
import { describe, it, expect } from "vitest";
import { isFrameVisible } from "./is-frame-visible";

describe("isFrameVisible", () => {
  it("可視フレームに対して true を返す", () => {
    const result = isFrameVisible(visibleFrame);
    expect(result).toBe(true);
  });

  it("不可視フレームに対して false を返す", () => {
    const result = isFrameVisible(hiddenFrame);
    expect(result).toBe(false);
  });
});
```

### テストコマンド

```bash
# ユニットテストを実行
pnpm test

# ウォッチモード
pnpm test --watch

# カバレッジ付き
pnpm test --coverage
```

## Playwright による E2E テスト

### テストファイルの配置

E2E テストは `e2e/` ディレクトリに配置します。

```
apps/web-ext/
├── src/
└── e2e/
    ├── fixtures.ts
    ├── site-profile.test.ts
    └── site-profile-fixtures.ts
```

### Fixtures の活用

```typescript
import { mergeTests } from "@playwright/test";
import { test as base, expect, popup } from "./fixtures";
import { test as siteProfileTest } from "./site-profile-fixtures";

const test = mergeTests(base, siteProfileTest).extend({});

test("Site Profile を取得検証できる", async ({
  context,
  page,
  validSiteProfile,
  credentialsMissingPage,
}) => {
  await validSiteProfile(
    { privateKey, publicKey },
    credentialsMissingPage.issuer,
  );
  await page.goto(credentialsMissingPage.endpoint);
  const ext = await popup(context);
  await expect(ext?.getByTestId("site-profile")).toBeVisible();
});
```

### テストコマンド

```bash
# E2E テストを実行
pnpm e2e

# ヘッドありモード（ブラウザ表示）
pnpm e2e --headed

# 特定のテストファイル
pnpm e2e site-profile.test.ts

# UI モード
pnpm e2e --ui
```

## VRT（Visual Regression Test）

### スクリーンショット比較

```typescript
test("Site Profile のビジュアルリグレッションテスト", async ({
  context,
  page,
  validSiteProfile,
  credentialsMissingPage,
}) => {
  // CI 環境でのみ実行
  test.skip(!process.env.CI, "VRT is only run in CI");

  await validSiteProfile(
    { privateKey, publicKey },
    credentialsMissingPage.issuer,
  );
  await page.goto(credentialsMissingPage.endpoint);
  const ext = await popup(context);

  // スクリーンショット比較
  await expect(ext).toHaveScreenshot("site-profile-popup.png");
});
```

### VRT のポイント

- `test.skip(!process.env.CI, ...)` で CI 環境でのみ実行
- スクリーンショットファイルは Git にコミット
- 差分が発生した場合は、意図した変更かどうかを確認

### スナップショット更新

```bash
# スナップショットを更新
pnpm e2e --update-snapshots
```

## テスト ID の使用

`data-testid` 属性でテスト対象を特定します。

```tsx
// コンポーネント
<div data-testid="site-profile">
  <span data-testid="site-profile-wsp-name">{name}</span>
</div>

// テスト
await expect(ext?.getByTestId("site-profile")).toBeVisible();
expect(await ext?.getByTestId("site-profile-wsp-name").innerText()).toBe("SiteProfileの取得検証");
```

## Vitest ESLint プラグイン

```javascript
// eslint.config.mjs
import vitest from "@vitest/eslint-plugin";

{
  plugins: { vitest },
  rules: {
    ...vitest.configs.recommended.rules,
  },
}
```

### 主要なルール

- `vitest/expect-expect`: テストに `expect` が含まれていることを確認
- `vitest/no-identical-title`: 同一の `describe`/`it` タイトルを禁止
- `vitest/valid-expect`: `expect` の正しい使用を確認
