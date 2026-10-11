# セキュリティチェック（2026-10-11）

- [x] `npm audit`: 脆弱性 0件
- [x] 秘密情報の混入: コード・設定・履歴に APIキー/トークン/パスワードなし（パターン検索で確認。gitleaks は環境に未導入のため未実施）
- [x] 本番配布物（`dist/`）の依存パッケージ: なし（`dependencies` 空、ランタイムは自前コードのみ）
- [x] OSSライセンス: docs/THIRD_PARTY_LICENSES.md 参照。GPL/AGPL等なし
- [x] XSS: `innerHTML` / `eval` / `document.write` を使用せず、ユーザー入力は常に `textContent` 経由。E2Eで `<img onerror>`/`<script>` 入力が実行されないことを確認
- [x] CSP: `default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'` 等で外部通信を技術的に禁止（`<meta>` で設定。ホスティング側でHTTPヘッダーのCSPも付けられるなら併用推奨）
- [x] インポート検証: バージョン・型・範囲・件数（請求書1000件/明細200行）・ファイルサイズ(5MB)を検証。不正値は矯正または拒否
- [x] CSVインジェクション: `= + - @` で始まる文字列項目に `'` を前置
- [x] W2 該当なし（サーバーなし）

残課題: ホスティング側でのセキュリティヘッダー（HTTP CSP、`X-Content-Type-Options` 等）の設定は公開時に人間が実施。
