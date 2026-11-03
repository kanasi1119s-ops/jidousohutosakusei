# セキュリティチェック
- [x] `npm audit`: 0件
- [x] 秘密情報: コード・設定に鍵/トークンなし（外部サービス未使用）
- [x] OSSライセンス: 本番配布物の依存はゼロ。開発ツールはMIT/Apache-2.0/ISC/BSD/MPL-2.0（lightningcss, 開発時のみ）で、GPL/AGPLなし。詳細は THIRD_PARTY_LICENSES.md
- [x] XSS: `innerHTML` 使用箇所はすべて `esc()` でユーザー入力をエスケープ（E2Eで検証）
- [x] CSP: `default-src 'self'` で外部通信を遮断
- [x] インポートJSON: `sanitizeInvoice` で型検証・明細200件上限
- [x] CSVインジェクション: 先頭が `= + - @` 等のセルを無効化
- 残課題: gitleaks未実行（本環境に未導入。目視確認のみ）
