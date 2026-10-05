# サードパーティライセンス一覧

## 本番（配布物）に含まれる依存パッケージ
**なし。** `npm ls --omit=dev` は空（2026-10-05確認）。配布物は自作コードのみ。

## 開発・ビルド時のみ（配布物に含まれない）
`license-checker --summary`（2026-10-05、自パッケージ除く）: MIT 82 / Apache-2.0 7 / ISC 3 / BSD-2-Clause 2 /
BSD-3-Clause 2 / MPL-2.0 2 / MIT-0 1。GPL/AGPL等のコピーレフトなし。
主なパッケージ: vite, vitest, @playwright/test, typescript, jsdom。

**判定**: 配布物に含まれないためライセンス条項は伝播せず、有料・無料いずれの提供形態とも衝突しない。
