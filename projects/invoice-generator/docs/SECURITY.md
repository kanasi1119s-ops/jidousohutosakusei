# セキュリティチェック記録（2026-10-19）

- [x] `npm audit`: 初回は high 1件（`source-map-js`、開発ツール経由・サービス拒否系）。`npm audit fix` で解消し 0件を確認
- [x] 本番配布物（`dist/`）への実行時依存パッケージはゼロ（devDependencies のみ）
- [x] 秘密情報: ソース・設定に APIキー/トークン/個人情報なし（`.env` 不使用）
- [x] OSSライセンス: `docs/THIRD_PARTY_LICENSES.md` 参照。GPL/AGPL なし。MPL-2.0 は開発時ビルドツール（lightningcss）のみで配布物に含まれない
- [x] XSS: ユーザー入力は `textContent` / `value` 経由でのみ DOM に反映し、`innerHTML` は固定文字列（静的テンプレート）にのみ使用
- [x] インポートJSON: `validateInvoice` で型・税率・端数処理・金額上限・明細数（200行）を検証。不正データは拒否
- [x] CSV: 先頭が `= + - @` の文字列は `'` を前置し、Excel の数式インジェクションを防止（単体テストあり）
- [x] CSP: `default-src 'self'; connect-src 'self'` により外部通信を技術的に遮断。外部フォント・CDN・解析タグなし
- 残課題: ホスティング側で HTTP ヘッダー（CSP, X-Content-Type-Options）を付与できる場合は追加を推奨（静的ホスティング設定は人間が実施）
