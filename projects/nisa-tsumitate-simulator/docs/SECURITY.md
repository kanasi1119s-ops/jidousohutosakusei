# セキュリティチェック（2026-11-05）
- [x] `npm audit`: 0件
- [x] 秘密情報: コードに APIキー・トークン・個人情報なし（grepで確認）
- [x] OSSライセンス: `docs/THIRD_PARTY_LICENSES.md`。本番配布物に依存パッケージなし、コピーレフト(GPL/AGPL)なし
- [x] XSS: ユーザー入力は数値化のみで innerHTML に未エスケープ文字列を埋め込まない（エラーは textContent）。インポートJSONは型検証
- [x] CSP: `default-src 'self'` ほかにより外部通信ゼロを担保。外部フォント/CDN/解析なし
- [x] W2項目: 該当なし
