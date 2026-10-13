# セキュリティチェック
- [x] `npm audit`: 0件（Round 1で1件解消）
- [x] 秘密情報: コミット対象にキー・トークンなし（`.env` 不要）
- [x] OSSライセンス: docs/THIRD_PARTY_LICENSES.md（開発依存のみ。本番バンドルは外部依存なし）。GPL/AGPLなし。MPL-2.0 は開発ツール内のみ
- [x] XSS: 結果表示は textContent のみ。innerHTMLは固定テンプレートと空文字クリアのみ
- [x] インポート: JSONを数値フィールド検証し未知キーは破棄
- [x] CSP: `default-src 'self'` ほか、外部通信ゼロ
- gitleaks は未導入のため grep による目視確認に留まる（残課題）
