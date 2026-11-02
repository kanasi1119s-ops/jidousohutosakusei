# セキュリティチェック（2026-11-02）
- [x] `npm audit`: 初回 4件（moderate 2 / high 2、vite・vitest・source-map-js、開発ツールのみ）→ `npm audit fix` で **0件**。修正後に全テスト成功を確認。
- [x] 秘密情報の混入: 正規表現による全ファイル走査で検出なし（gitleaks は未導入のため簡易確認。公開前に人間側で `gitleaks` 実行を推奨）。
- [x] OSSライセンス: `docs/THIRD_PARTY_LICENSES.md` 参照。コピーレフトなし。配布物に依存パッケージなし（`npm ls --omit=dev` が空）。
- [x] XSS: `innerHTML` は固定テンプレートのみ（ユーザー入力を含まない）。自治体名は `textContent` で描画。E2Eでスクリプト文字列が実行されないことを検証。
- [x] CSP: `default-src 'self'; connect-src 'self'` ほか。外部通信・外部フォント・インラインスクリプトなし。
- [x] CSV数式インジェクション: 先頭が `= + - @` 等の自治体名は `'` を付与して出力し、読込時に復元。
- [x] インポート検証: JSON/CSVともに型・日付・金額・件数（5,000件上限）を検証。失敗時は既存データを変更しない。
- [ ] 残課題: 静的ホスティング側でのHTTPヘッダ（`X-Content-Type-Options`, `Referrer-Policy`）設定は公開先に依存（人間作業）。
