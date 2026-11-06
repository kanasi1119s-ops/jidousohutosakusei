# サードパーティ・ライセンス一覧（開発時依存のみ）

本サイトの配信物（`dist/`）に同梱されるのは自作コードのみで、実行時に依存する外部パッケージはありません（`dependencies` は空）。
以下はビルド・テスト用の `devDependencies`（推移的依存を含む）のライセンス集計です（`package-lock.json` より、2026-11-06 時点）。

| ライセンス | 件数 |
|---|---|
| MIT | 97 |
| Apache-2.0 | 7 |
| MPL-2.0 | 12 |
| ISC | 3 |
| BSD-2-Clause | 2 |
| BSD-3-Clause | 2 |
| MIT-0 | 1 |

- GPL / AGPL 系のコピーレフトは検出されませんでした。
- MPL-2.0（主にビルドツール内部の CSS 変換ライブラリ）はファイル単位のコピーレフトですが、配信物には含まれません。
- 以下は MIT 以外のパッケージです:

- @csstools/color-helpers : MIT-0
- @playwright/test : Apache-2.0
- detect-libc : Apache-2.0
- entities : BSD-2-Clause
- expect-type : Apache-2.0
- lightningcss : MPL-2.0
- lightningcss-android-arm64 : MPL-2.0
- lightningcss-darwin-arm64 : MPL-2.0
- lightningcss-darwin-x64 : MPL-2.0
- lightningcss-freebsd-x64 : MPL-2.0
- lightningcss-linux-arm-gnueabihf : MPL-2.0
- lightningcss-linux-arm64-gnu : MPL-2.0
- lightningcss-linux-arm64-musl : MPL-2.0
- lightningcss-linux-x64-gnu : MPL-2.0
- lightningcss-linux-x64-musl : MPL-2.0
- lightningcss-win32-arm64-msvc : MPL-2.0
- lightningcss-win32-x64-msvc : MPL-2.0
- lru-cache : ISC
- picocolors : ISC
- playwright : Apache-2.0
- playwright-core : Apache-2.0
- saxes : ISC
- source-map-js : BSD-3-Clause
- tough-cookie : BSD-3-Clause
- typescript : Apache-2.0
- webidl-conversions : BSD-2-Clause
- xml-name-validator : Apache-2.0
