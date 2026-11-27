# サードパーティライセンス

## 配布物（dist/）に含まれる依存: なし
`dependencies` は空（`npm ls --omit=dev` で確認）。

## 開発・テスト時のみの依存（配布物に含まれない）
`package-lock.json` 上の主なライセンス: MIT（大半）、Apache-2.0、ISC、BSD系、MPL-2.0（`lightningcss`＝Viteのビルド時ツール）。
GPL/AGPL等の強いコピーレフトは検出されず。MPL-2.0 はビルドツールとして利用するのみで配布物に含まれないため、提供形態と衝突しない。
主なパッケージ: vite, vitest, @playwright/test, typescript, jsdom。

## アセット
`public/icons/icon.svg` は本プロジェクト用に作成した自作図形。
