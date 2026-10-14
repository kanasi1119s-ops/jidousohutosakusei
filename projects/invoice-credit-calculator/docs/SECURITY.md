# セキュリティチェック（2026-10-14）
- [x] `npm audit`: 0件（初回 high 1件は dev依存 source-map-js を `npm audit fix` で解消）
- [x] 秘密情報: ソース内のキー/トークン様文字列を grep で確認、検出なし（gitleaks は未使用）
- [x] OSSライセンス: 本番配布物の依存パッケージはゼロ（`docs/THIRD_PARTY_LICENSES.md`）
- [x] XSS: 取引先名は `escapeHtml` で出力。E2Eで `<img onerror>` が実行されないことを確認
- [x] CSP: `default-src 'self'`、外部リクエスト0件をE2Eで検査
- [x] CSVインジェクション: 出力時に `= + - @` 始まりのセルを無害化
- [x] インポート検証: JSON/CSVともに型・範囲・件数(5000行)を検証
- [ ] W2ではないため認証/CSRF等は対象外
