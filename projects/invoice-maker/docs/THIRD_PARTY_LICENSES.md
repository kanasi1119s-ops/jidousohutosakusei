# サードパーティライセンス一覧

## 本番（配布物）に含まれる依存パッケージ
**なし。** `dependencies` は空で、`dist/` は自前のHTML/CSS/JSのみ。外部フォント・CDN・アナリティクスも使用していません。

## 開発・ビルド時のみ（配布物には含まれない）
`license-checker` による 2026-10-11 時点の内訳（自パッケージ除く）:

| ライセンス | 件数 |
|---|---|
| MIT | 82 |
| Apache-2.0 | 7 |
| ISC | 3 |
| BSD-2-Clause | 2 |
| BSD-3-Clause | 2 |
| MPL-2.0 | 2 |
| MIT-0 | 1 |

主なパッケージ: vite, vitest, @playwright/test, typescript, jsdom。
**判定**: コピーレフト（GPL/AGPL）なし。開発時ツールのみのため配布物へのライセンス伝播なし。
