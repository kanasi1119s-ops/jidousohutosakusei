# セキュリティ検査（Security・2026-10-22）

- [x] `npm audit`: 脆弱性 0 件（開発依存のみ。配布物にサードパーティコードは含まれない）
- [x] 秘密情報: ソースに鍵・トークンのパターンなし（`gitleaks` は環境に無く、正規表現による簡易検査。コミット履歴は新規作成のため対象は今回の差分のみ）
- [x] OSSライセンス一覧: `docs/THIRD_PARTY_LICENSES.md`
- [x] XSS: `innerHTML`/`eval`/`document.write` を使用しない（`textContent`/DOM API のみ）。E2Eで `<img onerror>` が実行されないことを確認
- [x] インポートJSON: `sanitizeAppData` で型・長さ・列挙値・ID文字種を検証。5MB超は拒否。置換前に確認ダイアログ
- [x] CSVインジェクション: 先頭が `= + - @` 等のテキストセルに `'` を付与
- [x] CSP: `default-src 'self'` 他。E2Eで外部ドメインへのリクエストが0件であることを確認
- [x] W2対象外（サーバーなし）
- 残課題: ホスティング側で `Content-Security-Policy` 応答ヘッダ・`X-Content-Type-Options` を設定できると望ましい（meta CSP は `frame-ancestors` 非対応）
