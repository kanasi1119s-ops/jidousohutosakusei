# セキュリティチェック（2026-11-26）
- [x] `npm audit`: 初回 high 含む指摘あり（開発ツール vite / vitest / source-map-js）→ `npm audit fix` で **0件**。
- [x] 秘密情報: ソース・設定に鍵/トークン/個人情報なし（目視+grep。gitleaks未使用）。
- [x] ライセンス: 本番配布物の依存パッケージはゼロ。開発依存はMIT/ISC/BSD/Apache-2.0/MIT-0/MPL-2.0（GPL/AGPLなし）。`docs/THIRD_PARTY_LICENSES.md`。
- [x] XSS: 描画はすべて `textContent`。`innerHTML`/`eval` 不使用。E2Eで`<img onerror>`入力が無害なことを検証。
- [x] インポート検証: 型・列挙値・行数(500)・サイズ(2MB)を検証。不正時は状態を変更しない。
- [x] CSVインジェクション: `= + - @` 始まりの文字列に `'` を付与。
- [x] CSP: `default-src 'self'` 等で外部通信を遮断。
- W2項目: 該当なし（サーバー無し）。
