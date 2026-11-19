# セキュリティ検査（2026-11-19）
- [x] `npm audit`: 初回 4件（moderate 2 / high 2、いずれも開発ツール vite・vitest 系）→ `npm audit fix` で **0件**。更新後に全テスト成功
- [x] 秘密情報: ソース・設定内に API キー・トークン等なし（grep 確認。gitleaks は環境に無く未使用）
- [x] OSSライセンス: 本番配布物（dist）に含まれる依存パッケージはゼロ。開発依存は MIT/Apache-2.0/ISC/BSD/MPL-2.0/MIT-0。GPL/AGPL なし（`docs/THIRD_PARTY_LICENSES.md`）
- [x] XSS: ユーザー入力は `textContent` / `value` 経由のみ。`innerHTML` は固定文字列のみ。E2Eで `<img onerror>` が実行されないことを確認
- [x] CSP: `default-src 'self'; connect-src 'self'` 等。外部通信ゼロ。E2Eで外部リクエストなしを確認
- [x] インポート検証: スキーマ・税率・数値範囲・明細上限500・ファイルサイズ上限5MB
- [x] CSV インジェクション: 文字列セルの先頭 `= + - @` にアポストロフィを付与
- 残課題: CSP は `<meta>` 方式（静的ホスティングでヘッダ設定できない場合のため）。ホスティング側でヘッダ設定できるなら併用推奨
