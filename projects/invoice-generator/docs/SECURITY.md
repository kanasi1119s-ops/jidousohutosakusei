# セキュリティチェック（2026-10-04）
- [x] `npm audit`: 0件（本番依存パッケージはゼロ）
- [x] 秘密情報: コミット対象にAPIキー・トークン・個人情報なし（目視＋grep。gitleaksは未導入）
- [x] OSSライセンス: `docs/THIRD_PARTY_LICENSES.md`。配布物に含まれるサードパーティコードなし
- [x] XSS: ユーザー入力は `textContent` / `createTextNode` 経由のみ。`innerHTML` 不使用（E2Eで検証）
- [x] CSP: `default-src 'self'; connect-src 'self'` で外部通信を遮断。インラインスクリプト/スタイルなし
- [x] インポート検証: JSONは `sanitizeInvoice` で型・長さ・範囲を検証、壊れたファイルは拒否
- [x] CSVインジェクション: `= + - @` 始まりの文字列セルは先頭に `'` を付与
- 残課題: GitHub Pages等は応答ヘッダーでCSPを付けられないため、`<meta>` CSP に依存（`frame-ancestors` は meta では無効）
