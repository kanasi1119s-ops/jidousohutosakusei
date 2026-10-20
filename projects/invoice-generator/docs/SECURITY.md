# セキュリティチェック（2026-10-20）

- [x] `npm audit`: 脆弱性 0件
- [x] 秘密情報の混入: APIキー・トークン・秘密鍵のパターンをgrepで検索し検出なし（gitleaks は未導入のため簡易検査。`.env` は使用しない）
- [x] OSSライセンス: 本番配布物への依存パッケージは **0**（`npm ls --omit=dev` が空）。開発依存のコピーレフト（GPL/AGPL）なし → `THIRD_PARTY_LICENSES.md`
- [x] XSS: ユーザー入力は `textContent` / `value` 経由でのみ表示。`innerHTML` は固定文字列と空文字代入のみ。E2Eで `<img onerror>` 入力が実行されないことを確認
- [x] CSP: `default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'` 等。外部通信は技術的に不可
- [x] インポート検証: JSONは `version`・必須型を検証し、不正なら既存データを変更せずエラー表示
- [x] CSVインジェクション: セル先頭の `= + @` にアポストロフィを付与して数式化を防止（ユニットテストあり）
- [ ] 残課題: CSP を `<meta>` で指定しているため、ホスティング側でHTTPヘッダーでも指定できると望ましい（公開時に人間が設定）
