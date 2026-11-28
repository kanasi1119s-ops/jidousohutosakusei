# セキュリティチェック（2026-11-28）
- [x] `npm audit`: 初回 high 含む指摘あり（vite / vitest / source-map-js、開発ツールのみ）→ `npm audit fix` で **0件** に解消、テスト再実行で成功
- [x] 秘密情報: 手動grepで鍵・トークン様文字列なし（gitleaks 未使用）。`.env` 不要
- [x] OSSライセンス: docs/THIRD_PARTY_LICENSES.md。コピーレフト（GPL/AGPL）なし
- [x] XSS: ユーザー入力を innerHTML に入れていない（textContentのみ。innerHTMLは固定テンプレートのみ）
- [x] CSP: `default-src 'self'` ほか外部通信を遮断。E2Eで外部リクエスト0件を検証
- [x] インポートJSON: 型・範囲を検証して sanitizeInput でクランプ
- [x] CSVインジェクション: 先頭が = + - @ の文字列を無害化（現状出力は固定ラベルと数値のみ）
- [x] W2項目: 該当なし（W1）
