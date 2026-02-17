# Canary Release

Web Extension と WordPress プラグインのカナリアリリースを GitHub に公開。

## ローカル実行

### 前提条件

- `apps/web-ext/web-ext-artifacts/*.zip` が存在すること
- `packages/wordpress/dist/*.zip` が存在すること
- `gh` CLI がインストールされ、認証済みであること

### 実行

```bash
.github/actions/canary/release.sh
```

## 動作

1. `.github/dist/` に両方の `.zip` をコピー
2. バージョン番号（`-1.2.3.zip`）を `-canary.zip` に置換
3. GitHub の `canary` プレリリースを作成/更新
