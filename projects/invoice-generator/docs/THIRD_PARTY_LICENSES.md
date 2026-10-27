# サードパーティライセンス一覧

## 配布物（dist/）に含まれる依存パッケージ
**なし。** `dependencies` は空で、実行時に読み込まれるサードパーティのコード・フォント・画像はありません。

## 開発・ビルド・テスト時のみの依存（配布物に含まれない）
`license-checker-rseidelsohn --summary` の結果（2026-10-27、自パッケージの `UNLICENSED` 1件を除く）:

| ライセンス | 件数 |
|---|---|
| MIT | 82 |
| Apache-2.0 | 7 |
| ISC | 3 |
| BSD-2-Clause | 2 |
| BSD-3-Clause | 2 |
| MPL-2.0 | 2 |
| MIT-0 | 1 |

主なパッケージ: vite, vitest, @playwright/test, typescript, jsdom。GPL/AGPL 等のコピーレフトは検出されませんでした。いずれも配布物には含まれないため、有料配布・独自利用規約での提供と衝突しません。
