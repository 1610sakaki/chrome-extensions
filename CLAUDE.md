# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 開発フロー

ビルドステップなし。ファイルを編集したら Chrome で拡張機能をリロードするだけ。

```
chrome://extensions/ → 対象拡張の「更新」ボタン（↺）をクリック
```

content script の変更はページをリロードしないと反映されない。popup/background の変更は拡張機能の更新のみでOK。

## リポジトリ構成

各サブフォルダが独立した Chrome 拡張機能。それぞれ個別に Chrome に読み込む。

```
auto-dark-mode/     OSダークモード時にCSS filterで未対応ページを自動ダーク化
tab-auto-closer/    非アクティブタブを一定時間後に自動クローズ
```

## アーキテクチャパターン

### Manifest V3 共通ルール
- ビルドツール・バンドラー不使用（素のJS）
- `chrome.storage.sync` で設定を永続化（Googleアカウント同期あり）
- ローカル状態（タブのタイムスタンプ等）は `chrome.storage.local`

### auto-dark-mode のデータフロー

```
content.js 起動
  → chrome.storage.sync から設定読み込み
  → OS dark mode 判定 (matchMedia)
  → ページのネイティブ対応チェック (CSSMediaRule / meta color-scheme)
  → 条件合致時に <style id="auto-dark-mode-style"> を注入
  → chrome.storage.onChanged を監視してリアルタイム反映
  → matchMedia change イベントでOS切替にも追随

popup.js
  → 設定を chrome.storage.sync に書き込むだけ
  → content.js 側が onChanged で検知して即時反映（メッセージ不要）
```

設定スキーマ（`chrome.storage.sync`）:
```js
{
  enabled: true,          // 拡張全体ON/OFF
  filterStrength: 100,    // invert強度 10〜100%
  forceMode: false,       // ネイティブ対応ページにも強制適用
  excludedSites: [],      // 除外ホスト名の配列
}
```

### tab-auto-closer のデータフロー

```
background.js (Service Worker)
  → chrome.alarms で1分ごとに checkAndCloseTabs() を起動
  → tabs.onActivated / windows.onFocusChanged でタブの最終アクティブ時刻を記録
  → 閾値超過 & ピン留めなし & フォーカス中ウィンドウのアクティブタブ以外 → close
```

## アイコン生成

元画像（512px程度）から3サイズを生成する手順:

```bash
# 余白トリム → 正方形化 → リサイズ
magick source.png -trim +repage /tmp/trimmed.png
magick /tmp/trimmed.png -gravity center -background none \
  -extent "$(magick identify -format '%[fx:max(w,h)]x%[fx:max(w,h)]' /tmp/trimmed.png)" /tmp/square.png
magick /tmp/square.png -resize 128x128 icons/icon128.png
magick /tmp/square.png -resize 48x48  icons/icon48.png
magick /tmp/square.png -resize 16x16  icons/icon16.png
```

## 新しい拡張機能を追加するとき

1. `新拡張名/` フォルダを作成
2. `manifest.json`（Manifest V3）を作成
3. `icons/` に icon16/48/128.png を配置
4. Chrome に「パッケージ化されていない拡張機能を読み込む」で登録
