# サードパーティライセンス

本番配布物（`dist/`）には外部ライブラリを含みません（自前のTypeScriptのみ）。
開発時のみ使用: typescript (Apache-2.0), vite (MIT), vitest (MIT), jsdom (MIT), @playwright/test (Apache-2.0)、
およびその推移的依存（MIT/ISC/BSD/Apache-2.0、MPL-2.0: lightningcss はビルド時のみ）。
2026-11-12時点で `node_modules` 内の `package.json` の license フィールドを集計（MIT 82 / Apache-2.0 7 / ISC 3 / BSD 4 / MPL-2.0 2 / MIT-0 1、license欄なし8はサブパッケージ）。
コピーレフト（GPL/AGPL）は検出されていません。
