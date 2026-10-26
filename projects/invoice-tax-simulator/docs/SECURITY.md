# セキュリティチェック（Security）
- [x] 依存脆弱性: `npm audit`（結果は docs/REPORT.md 参照）
- [x] 秘密情報: ソース・履歴にキー/トークンなし（grepで確認）
- [x] OSSライセンス: 配布物の依存ゼロ（docs/THIRD_PARTY_LICENSES.md）
- [x] XSS: ユーザー入力はテキストとしてのみ処理。結果表は textContent で生成（innerHTML は静的テンプレートのみ）。E2Eで検証
- [x] CSP: `default-src 'self'; connect-src 'self'` 等により外部通信を技術的に禁止
- [x] JSONインポート: 許可フィールドのみ取り出し、型・範囲・選択肢を検証（storage.ts の sanitizeInput）
- [ ] W2項目: 該当なし（サーバーなし）
