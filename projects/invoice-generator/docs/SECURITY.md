# セキュリティ検査記録（2026-10-27）

- [x] `npm audit`: 脆弱性 0 件
- [x] 秘密情報: ソース・設定に APIキー/トークン/パスワードなし（正規表現での走査と GitHub secret scanning を実施。結果は日次レポート参照）。`.env` は不要
- [x] OSSライセンス: `docs/THIRD_PARTY_LICENSES.md`。配布物に含まれる依存パッケージはゼロ。開発時依存にGPL/AGPLなし
- [x] XSS: ユーザー入力は `textContent`／`setAttribute`／`value` のみで扱い、`innerHTML`・`eval` 不使用（E2Eで `<img onerror>` が実行されないことを確認）
- [x] インポート検証: JSONは型・列挙値・長さ（2000文字/明細200行/保存500件）を検証し、不正時は日本語エラー
- [x] CSVインジェクション: 先頭が `= + - @` の文字列に `'` を付与
- [x] CSP: `default-src 'self'; connect-src 'self'` ほか。外部通信なし
- [ ] W2向け項目（認証・CSRF等）: 対象外（W1）
残課題: CSP は meta タグで設定している。ホスティング側でHTTPヘッダ設定ができる場合は同等のヘッダ設定を推奨。
