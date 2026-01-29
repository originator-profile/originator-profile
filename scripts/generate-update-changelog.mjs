#!/usr/bin/env node

/**
 * 依存関係の更新内容をchangelogとしてまとめるスクリプト
 * 
 * このスクリプトは `pnpm run update` コマンドから自動的に呼び出されます。
 * 内部的に以下の処理を実行:
 * 1. 更新前: バージョン情報を保存 (save コマンド)
 * 2. 更新後: changelogを生成 (generate コマンド)
 * 
 * 手動で実行する場合:
 *   node scripts/generate-update-changelog.mjs save
 *   pnpm --recursive update --latest
 *   node scripts/generate-update-changelog.mjs generate
 */

import { execSync } from 'child_process';
import fs from 'fs';

const VERSIONS_FILE = '.dependency-versions.json';
const CHANGELOG_FILE = 'DEPENDENCY_UPDATE_CHANGELOG.md';

/**
 * 現在インストールされている全パッケージのバージョンを取得
 */
function getCurrentVersions() {
  try {
    const output = execSync('pnpm list --json --recursive --depth=0', {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    });
    
    const data = JSON.parse(output);
    const versions = {};
    
    for (const item of data) {
      if (item.dependencies) {
        Object.entries(item.dependencies).forEach(([name, info]) => {
          // 最初に見つけたバージョンを使用（ワークスペース全体で最も高いバージョンではない可能性がある）
          if (!versions[name]) {
            versions[name] = info.version;
          }
        });
      }
      if (item.devDependencies) {
        Object.entries(item.devDependencies).forEach(([name, info]) => {
          // 最初に見つけたバージョンを使用（ワークスペース全体で最も高いバージョンではない可能性がある）
          if (!versions[name]) {
            versions[name] = info.version;
          }
        });
      }
    }
    
    return versions;
  } catch (error) {
    console.error('パッケージ一覧の取得に失敗しました:', error.message);
    return {};
  }
}

/**
 * パッケージ名からnpmパッケージURLを生成
 */
function getNpmUrl(packageName) {
  return `https://www.npmjs.com/package/${packageName}`;
}

/**
 * パッケージ名からGitHubリポジトリURLを取得（可能な場合）
 */
function getPackageInfo(packageName) {
  try {
    // パッケージ名をクォートでエスケープして安全性を確保
    const escapedName = packageName.replace(/'/g, "'\\''");
    const output = execSync(`npm view '${escapedName}' repository.url homepage --json`, {
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024,
    });
    
    const data = JSON.parse(output);
    let repoUrl = null;
    
    if (data['repository.url']) {
      repoUrl = data['repository.url']
        .replace(/^git\+/, '')
        .replace(/\.git$/, '')
        .replace(/^git:\/\//, 'https://')
        .replace(/^ssh:\/\/git@github\.com\//, 'https://github.com/')
        .replace(/^ssh:\/\/git@/, 'https://');
    }
    
    return {
      repository: repoUrl,
      homepage: data.homepage,
    };
  } catch (error) {
    return { repository: null, homepage: null };
  }
}

/**
 * バージョン間の比較リンクを生成
 */
function getCompareUrl(repoUrl, oldVersion, newVersion) {
  if (!repoUrl || !repoUrl.includes('github.com')) {
    return null;
  }
  
  // vプレフィックスを考慮
  const oldTag = oldVersion.startsWith('v') ? oldVersion : `v${oldVersion}`;
  const newTag = newVersion.startsWith('v') ? newVersion : `v${newVersion}`;
  
  return `${repoUrl}/compare/${oldTag}...${newTag}`;
}

/**
 * リリースノートのURLを生成
 */
function getReleaseUrl(repoUrl, version) {
  if (!repoUrl || !repoUrl.includes('github.com')) {
    return null;
  }
  
  const tag = version.startsWith('v') ? version : `v${version}`;
  return `${repoUrl}/releases/tag/${tag}`;
}

/**
 * バージョン情報を保存
 */
function saveVersions() {
  console.log('現在の依存関係バージョンを保存しています...');
  const versions = getCurrentVersions();
  fs.writeFileSync(VERSIONS_FILE, JSON.stringify(versions, null, 2));
  console.log(`✓ バージョン情報を ${VERSIONS_FILE} に保存しました`);
  console.log(`  合計 ${Object.keys(versions).length} パッケージ`);
}

/**
 * 変更履歴を生成
 */
function generateChangelog() {
  console.log('変更履歴を生成しています...');
  
  // 保存されたバージョン情報を読み込み
  if (!fs.existsSync(VERSIONS_FILE)) {
    console.error(`エラー: ${VERSIONS_FILE} が見つかりません`);
    console.error('先に "node scripts/generate-update-changelog.mjs save" を実行してください');
    process.exit(1);
  }
  
  const oldVersions = JSON.parse(fs.readFileSync(VERSIONS_FILE, 'utf-8'));
  const newVersions = getCurrentVersions();
  
  // 変更されたパッケージを抽出
  const updates = [];
  const added = [];
  const removed = [];
  
  for (const [name, newVersion] of Object.entries(newVersions)) {
    if (!oldVersions[name]) {
      added.push({ name, version: newVersion });
    } else if (oldVersions[name] !== newVersion) {
      updates.push({
        name,
        oldVersion: oldVersions[name],
        newVersion,
      });
    }
  }
  
  for (const [name, oldVersion] of Object.entries(oldVersions)) {
    if (!newVersions[name]) {
      removed.push({ name, version: oldVersion });
    }
  }
  
  // Markdownレポートを生成
  let markdown = '# 依存関係更新レポート\n\n';
  markdown += `生成日時: ${new Date().toISOString()}\n\n`;
  
  markdown += '## 📊 更新サマリー\n\n';
  markdown += `- 🔄 更新: ${updates.length} パッケージ\n`;
  markdown += `- ➕ 追加: ${added.length} パッケージ\n`;
  markdown += `- ➖ 削除: ${removed.length} パッケージ\n`;
  markdown += `- 📦 合計: ${Object.keys(newVersions).length} パッケージ\n\n`;
  
  if (updates.length > 0) {
    markdown += '## 🔄 更新されたパッケージ\n\n';
    
    console.log(`${updates.length} 件の更新を処理中...`);
    
    for (let i = 0; i < updates.length; i++) {
      const update = updates[i];
      // 進捗表示: 1, 11, 21, 31, ... を表示
      if (i === 0 || (i + 1) % 10 === 1) {
        console.log(`  進捗: ${i + 1}/${updates.length}`);
      }
      
      markdown += `### ${update.name}\n\n`;
      markdown += `**${update.oldVersion}** → **${update.newVersion}**\n\n`;
      
      const info = getPackageInfo(update.name);
      
      markdown += '**リンク:**\n';
      markdown += `- 📦 [npm](${getNpmUrl(update.name)})\n`;
      
      if (info.repository) {
        markdown += `- 🔗 [Repository](${info.repository})\n`;
        
        const compareUrl = getCompareUrl(info.repository, update.oldVersion, update.newVersion);
        if (compareUrl) {
          markdown += `- 📝 [変更内容を比較](${compareUrl})\n`;
        }
        
        const releaseUrl = getReleaseUrl(info.repository, update.newVersion);
        if (releaseUrl) {
          markdown += `- 🎉 [リリースノート](${releaseUrl})\n`;
        }
      }
      
      if (info.homepage && info.homepage !== info.repository) {
        markdown += `- 🏠 [Homepage](${info.homepage})\n`;
      }
      
      markdown += '\n';
    }
  }
  
  if (added.length > 0) {
    markdown += '## ➕ 追加されたパッケージ\n\n';
    for (const pkg of added) {
      markdown += `- **${pkg.name}** (${pkg.version})\n`;
      markdown += `  - 📦 [npm](${getNpmUrl(pkg.name)})\n`;
    }
    markdown += '\n';
  }
  
  if (removed.length > 0) {
    markdown += '## ➖ 削除されたパッケージ\n\n';
    for (const pkg of removed) {
      markdown += `- **${pkg.name}** (${pkg.version})\n`;
    }
    markdown += '\n';
  }
  
  markdown += '---\n\n';
  markdown += '*このレポートは自動生成されました。*\n';
  
  // ファイル書き込みとクリーンアップを try-finally で保護
  try {
    fs.writeFileSync(CHANGELOG_FILE, markdown);
    console.log(`\n✓ 変更履歴を ${CHANGELOG_FILE} に生成しました`);
    
    // 統計情報を表示
    console.log('\n📊 更新サマリー:');
    console.log(`  🔄 更新: ${updates.length} パッケージ`);
    console.log(`  ➕ 追加: ${added.length} パッケージ`);
    console.log(`  ➖ 削除: ${removed.length} パッケージ`);
  } finally {
    // 保存ファイルをクリーンアップ（エラー時も必ず実行）
    if (fs.existsSync(VERSIONS_FILE)) {
      fs.unlinkSync(VERSIONS_FILE);
      console.log(`\n🧹 一時ファイル ${VERSIONS_FILE} を削除しました`);
    }
  }
}

/**
 * メイン処理
 */
const command = process.argv[2];

if (command === 'save') {
  saveVersions();
} else if (command === 'generate') {
  generateChangelog();
} else {
  console.log('使用方法:');
  console.log('  更新前: node scripts/generate-update-changelog.mjs save');
  console.log('  更新後: node scripts/generate-update-changelog.mjs generate');
  process.exit(1);
}
