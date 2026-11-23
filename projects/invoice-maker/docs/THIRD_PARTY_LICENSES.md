# サードパーティライセンス（Phase 5）
本番配布物（`dist/`）に同梱されるサードパーティコードはありません（`npm ls --omit=dev` は空）。
以下は開発時依存（devDependencies、推移的依存を含む計97件）のライセンス集計（`license-checker --summary`、2026-11-23）。

| ライセンス | 件数 |
|---|---|
| MIT | 82 |
| Apache-2.0 | 7 |
| ISC | 3 |
| BSD-2-Clause | 2 |
| BSD-3-Clause | 2 |
| MPL-2.0 | 2（ビルド時ツールのみ。配布物に含まれない） |
| MIT-0 | 1 |
| UNLICENSED | 1（本プロジェクト自身） |

GPL/AGPL等の強いコピーレフトは含まれません。依存追加時は再集計してください。
