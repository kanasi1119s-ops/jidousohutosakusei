# セキュリティチェック（Phase 5）
- [x] `npm audit`: 脆弱性0件（2026-11-14）
- [x] 秘密情報: ソース・設定に鍵/トークン/個人情報なし（grep確認。gitleaksは環境に無く未実施。履歴は本サイクルのコミットのみ）
- [x] OSSライセンス: `docs/THIRD_PARTY_LICENSES.md`
- [x] XSS: `innerHTML`不使用（DOM APIとtextContentのみ）。E2Eで`<img onerror>`/`<script>`入力が実行されないことを検証
- [x] インポート検証: JSONはスキーマ正規化(`sanitizeDoc`)、2MB上限、文字数上限、`app`識別子確認
- [x] CSP: `default-src 'self'; connect-src 'self'` 等で外部通信遮断。E2Eで外部リクエスト0件を確認
- [x] CSV数式注入対策あり
- [ ] 残課題: CSPは`<meta>`方式のため`frame-ancestors`は指定不可。ホスティング側のヘッダで設定可能なら追加を推奨
- W2項目は対象外（サーバーなし）
