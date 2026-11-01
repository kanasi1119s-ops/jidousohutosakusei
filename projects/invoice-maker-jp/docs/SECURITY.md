# セキュリティチェック（Phase 5）
- [x] `npm audit`: 脆弱性 0件
- [x] 秘密情報: ソース内にAPIキー・トークン・鍵形式の文字列なし（grep確認）。リポジトリ履歴は本サイクルの追加分のみ
- [x] OSSライセンス: `docs/THIRD_PARTY_LICENSES.md`
- [x] XSS: `innerHTML`/`eval` 不使用。すべて `textContent`/DOM API。E2Eで `<img onerror>` が実行されないことを確認
- [x] インポート検証: JSONは `sanitizeInvoice` で型・長さ・件数(500)を制限
- [x] CSVインジェクション: 先頭が `= + - @` のセルに `'` を付与
- [x] CSP: `default-src 'self'; connect-src 'self'` で外部通信を技術的に遮断
- [x] W2項目: 該当なし（サーバーなし）
