# セキュリティチェック（2026-11-22）

- [x] `npm audit`: 脆弱性 0 件
- [x] 実行時依存パッケージ: ゼロ（`npm ls --prod` が空）
- [x] 秘密情報: ソース・設定に APIキー/トークン/個人情報なし（`gitleaks` は環境に無いため `grep` による目視確認。要すれば人間側で gitleaks 実行）
- [x] XSS: ユーザー入力は `textContent` / `createTextNode` のみで描画。`innerHTML`/`eval` 不使用（E2Eで `<img onerror>` が実行されないことを確認）
- [x] CSP: `default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'` … 外部通信を遮断（E2Eで外部リクエスト 0 件を確認）
- [x] インポートJSON: `parseAppData` で型・件数・文字数を検証
- [x] CSVインジェクション: 先頭が `= + - @` 等のセルを無効化
- [x] 該当なし: W2（サーバー）関連項目
- 残課題: localStorage は端末上で平文保存（ブラウザを共有する環境では利用者側で注意が必要）。README・LP に明記済み
