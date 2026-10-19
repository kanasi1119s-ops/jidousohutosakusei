# サードパーティライセンス（2026-10-19 時点）

本番配布物（`dist/`）に含まれる外部ライブラリはありません（自作コードのみ）。以下は開発・ビルド・テスト時のみ使用するパッケージです。

`license-checker-rseidelsohn --summary` の結果（推移的依存を含む約100パッケージ）:

| ライセンス | 件数 |
|---|---|
| MIT | 84 |
| Apache-2.0 | 7 |
| ISC | 4 |
| MPL-2.0 | 3（lightningcss 系。ビルド時のみ・配布物に含まれない） |
| BSD-2-Clause / BSD-3-Clause | 各2 |
| MIT-0 | 1 |
| UNLICENSED | 1（本プロジェクト自身。`private` パッケージ） |

GPL / AGPL 等の強いコピーレフトは検出されませんでした。再生成: `npx license-checker-rseidelsohn --summary`
