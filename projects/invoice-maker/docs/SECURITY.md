# セキュリティチェック（2026-10-21）
- [x] `npm audit`: 0件（初回 high 2件→`npm audit fix`で解消）
- [x] 秘密情報: コミット対象にキー・トークン・個人情報なし（gitleaks未導入のため正規表現grepで代替確認）
- [x] OSSライセンス: 本番バンドルへの依存パッケージはゼロ（`docs/THIRD_PARTY_LICENSES.md`）。GPL/AGPLなし
- [x] XSS: ユーザー入力は `textContent` でのみ描画（`innerHTML` は固定文字列のみ）。E2Eで検証
- [x] CSP: `default-src 'self'; connect-src 'self'` で外部通信を技術的に遮断
- [x] CSVインジェクション: `= + - @` で始まる文字列を無効化して出力
- [x] インポート検証: JSONの型・列挙値を `isDoc` で検証
- W2要素（認証・CSRF等）: 該当なし
