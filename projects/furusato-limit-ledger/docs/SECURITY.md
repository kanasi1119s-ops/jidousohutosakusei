# セキュリティチェック（2026-11-10）
- [x] `npm audit`: 脆弱性 0 件
- [x] 秘密情報: コード・設定に鍵/トークン/個人情報なし（`.env` 不使用）
- [x] OSSライセンス: 本番配布物（dist）への依存パッケージはゼロ（自作コードのみ）。開発ツールはMIT/Apache-2.0等 → `THIRD_PARTY_LICENSES.md`
- [x] XSS: ユーザー入力は `textContent` のみで描画（`innerHTML` 不使用）。E2Eで `<img onerror>` が実行されないことを確認
- [x] CSP: `default-src 'self'; connect-src 'self'`（外部通信不可）
- [x] インポート検証: JSON/CSVともに型・日付・金額を検証し不正時はエラー
- 残課題: なし（W1のため認証・CSRF・DBは対象外）
