# セキュリティチェック（2026-11-17）
- [x] `npm audit`: 脆弱性0件
- [x] 秘密情報: パターン検索（AKIA/ghp_/sk-/PRIVATE KEY）で検出なし。`gitleaks` は環境に無く未実施
- [x] OSSライセンス: 本番バンドルへの依存パッケージなし（devDependenciesのみ）。MIT/Apache-2.0/ISC/BSD/MPL-2.0（開発ツール内）、GPL/AGPLなし → `THIRD_PARTY_LICENSES.md`
- [x] XSS: ユーザー入力は `textContent`/DOM API のみで描画（`innerHTML` 不使用）。E2Eで検証
- [x] CSP: `default-src 'self'` ほかで外部通信を遮断。E2Eで外部リクエストゼロを検証
- [x] インポートJSON: 形式検証（`sanitizeInvoice`）・件数/文字数上限
- [x] CSV: 数式インジェクション対策（先頭 `= + - @` を無害化）
- 残課題: CSPの `style-src 'self'` によりインラインstyleは不可（現状不使用）
