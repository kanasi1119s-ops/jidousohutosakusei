# セキュリティチェック（2026-11-21）
- [x] `npm audit`: 0件
- [x] 秘密情報: パターン検索で検出なし（gitleaks は未使用）
- [x] OSSライセンス: 本番配布物に依存パッケージなし（`docs/THIRD_PARTY_LICENSES.md`）
- [x] XSS: ユーザー入力は textContent / value のみで描画。innerHTML は固定文字列のみ。E2Eで検証
- [x] CSP: `default-src 'self'; connect-src 'self'` で外部通信を遮断
- [x] インポートJSON: format検証＋型サニタイズ（明細200件・保存500件上限）
- [x] CSV: 数式インジェクション対策（`=+-@` 始まりに `'` 付与）
- 残課題: GitHub Pages配信時はHTTPヘッダーでのCSP/ X-Frame-Options 設定不可（meta CSPのみ）
