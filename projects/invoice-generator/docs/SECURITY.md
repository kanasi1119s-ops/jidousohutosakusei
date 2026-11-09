# セキュリティチェック（2026-11-09）
- [x] `npm audit`: 0件
- [x] 秘密情報: ソース・設定にAPIキー等なし（正規表現検索）。外部通信なし
- [x] OSSライセンス: 本番配布物の依存パッケージはゼロ（`npm ls --omit=dev` が空）。開発依存はMIT/Apache-2.0/ISC/BSD/MPL-2.0/MIT-0。コピーレフト(GPL/AGPL)なし。詳細は THIRD_PARTY_LICENSES.md
- [x] XSS: ユーザー入力を含むHTMLはすべて `escapeHtml` 経由（ユニット・E2Eで検証）。ステータス表示は textContent
- [x] インポート検証: JSONはアプリ識別子・id形式・日付・数値型・件数上限を検証し無害化（不正行はスキップ）
- [x] CSVインジェクション: 文字列フィールド先頭の `= + - @` にアポストロフィを付与
- [x] CSP: `default-src 'self'` ほか（connect-srcも self のみ）。外部ドメインへの通信ゼロをE2Eで確認
- 残課題: ホスティング側でCSPヘッダーを追加する場合は meta と同内容を推奨（人間作業）
