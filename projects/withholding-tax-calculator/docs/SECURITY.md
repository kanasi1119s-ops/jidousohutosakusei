# セキュリティチェック（2026-09-29）
- [x] `npm audit`: 0件
- [x] 秘密情報: ソース内にAPIキー・トークン等なし（`.env` 不要）
- [x] OSSライセンス: 本番配布物に依存パッケージなし。開発依存はMIT/Apache-2.0/ISC/BSD/MPL-2.0/MIT-0（コピーレフトによる衝突なし。一覧は THIRD_PARTY_LICENSES.md）
- [x] XSS: ユーザー入力（項目名）は escapeHtml 後に innerHTML へ。E2Eで検証
- [x] CSP: `default-src 'self'` ほか（外部通信ゼロ）
- [x] インポート検証: JSONは型・範囲・区分を検証。不正は拒否
- [x] CSVインジェクション: 先頭が = + - @ の項目は `'` を前置
- W2項目は対象外（サーバーなし）
