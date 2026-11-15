# セキュリティチェック

- [x] `npm audit`: 初回 4件（high 2 / moderate 2、開発ツールのみ）→ `npm audit fix` で **0件**。修正後に全テスト成功
- [x] 秘密情報: ソース内にキー・トークン類なし（grep確認）。`gitleaks` は環境に無く未実施（CIへの追加は任意の残課題）
- [x] OSSライセンス: 本番依存0件、開発依存は MIT/Apache-2.0/ISC/BSD/MPL-2.0 等（`THIRD_PARTY_LICENSES.md`）。GPL/AGPLなし
- [x] XSS: `innerHTML`/`eval` 不使用。全表示を `textContent` 経由で生成。E2Eで `<img onerror>`/`<script>` 入力が実行されないことを確認
- [x] CSP: `default-src 'self'` ほか（外部通信ゼロ）。E2Eで外部リクエストが0件であることを確認
- [x] インポート: JSONはアプリ識別子・バージョンを検証し、全項目をサニタイズ（型・長さ・範囲）。20MB超は拒否
- [x] CSVインジェクション: `= + @` 等で始まるセルに `'` を前置
- 残課題: gitleaks等のCI導入（任意）。W2ではないため認証・CSRF等は対象外
