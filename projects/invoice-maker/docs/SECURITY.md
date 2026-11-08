# セキュリティチェック（2026-11-08）
- [x] `npm audit`: 初回 4件(moderate2/high2、vite/vitest等の開発ツール) → `npm audit fix` で **0件**、再テスト成功
- [x] 秘密情報: ソース内に鍵・トークン無し（grep確認。gitleaks は環境に無く未実施）
- [x] OSSライセンス: 本番配布物の依存パッケージは**ゼロ**。開発依存はMIT/Apache-2.0/ISC/BSD/MPL-2.0(lightningcss,ビルド時のみ)。GPL/AGPLなし → `THIRD_PARTY_LICENSES.md`
- [x] XSS: ユーザー入力は textContent/value のみ。`innerHTML` は静的テンプレート1箇所のみ。E2Eで検証
- [x] CSP: `default-src 'self'; connect-src 'self'` 等で外部通信を遮断
- [x] インポート検証: アプリID・型・件数・文字数を検証（`sanitizeInvoice`）、10MB上限
- [x] CSVインジェクション: `= + - @` 始まりの値に `'` を付与
- 残課題: Content-Security-Policy は meta 指定のため、ホスティング側でHTTPヘッダ化できるとより堅牢
