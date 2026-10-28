# セキュリティチェック（Phase 5）
- [x] `npm audit`: 脆弱性0件
- [x] 秘密情報: コード・設定に鍵/トークン/個人情報なし（`.env` 不使用）
- [x] OSSライセンス: 本番配布物に含まれる依存パッケージはゼロ（`docs/THIRD_PARTY_LICENSES.md`）
- [x] XSS: `innerHTML` は固定テンプレート1箇所のみ（ユーザー入力を含まない）。結果表示は `textContent`
- [x] インポートJSON: `normalizeInput` で型・列挙値を厳格検証、不正時はエラー表示
- [x] CSP: `default-src 'self'; connect-src 'self'` で外部通信を遮断。ビルド成果物に外部URLなし
- [ ] gitleaks 等のツールは未実行（本環境未導入）。目視とgrepでの確認のみ
