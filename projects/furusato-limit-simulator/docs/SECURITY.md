# セキュリティチェック（Phase 5）
- [x] `npm audit`: 0件
- [x] 秘密情報: ソース・設定に鍵・トークン・個人情報なし（gitleaks未導入のため正規表現とgrepで確認。`.env` 不使用）
- [x] OSSライセンス: 本番配布物に含まれる依存パッケージはゼロ（ビルド成果物は自作コードのみ）。開発依存は MIT/Apache-2.0/ISC/BSD/MPL-2.0（lightningcss, 開発時のみ）。GPL/AGPL なし。`docs/THIRD_PARTY_LICENSES.md`
- [x] XSS: ユーザー入力（自治体名）は `textContent` のみで描画。E2Eで `<img onerror>` が実行されないことを検証
- [x] CSP: `default-src 'self'; connect-src 'self'` 等で外部通信を禁止
- [x] インポート: JSONを型・範囲検証（`parseAppData`、寄附データも `validateDonation` で検証）
- [x] CSVインジェクション: 数式開始文字（`= + - @`）で始まる値の先頭に `'` を付与
- [x] W2の項目: 該当なし（サーバーなし）
