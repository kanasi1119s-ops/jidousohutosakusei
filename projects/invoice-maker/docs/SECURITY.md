# セキュリティチェック記録（2026-10-06）

- [x] `npm audit`: 0件（High以上なし）
- [x] 秘密情報の混入: コミット対象ファイルを正規表現（ghp_/github_pat_/sk-/AKIA/秘密鍵ヘッダ）で走査し検出なし（gitleaks は環境に無く未使用）。`.env` 不要の設計
- [x] OSSライセンス: `docs/THIRD_PARTY_LICENSES.md` 参照。**本番配布物（dist）に含まれる外部ライブラリはゼロ**
- [x] XSS: ユーザー入力はすべて `textContent` / `value` 経由で表示。`innerHTML` は不使用。E2Eで `<img onerror>`・`<script>` の入力が実行されないことを確認
- [x] CSP: `default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'` など。外部通信を技術的に遮断。E2Eで同一オリジン以外へのリクエストがないことを確認
- [x] インポートファイル検証: `sanitizeAppData` で型・長さ・税率・件数（請求書1000件／明細200行）を検証。不正JSONは拒否し既存データを保持
- [x] CSVインジェクション: 先頭が `= + - @` のセルは先頭に `'` を付与
- [x] W1のため認証・CSRF・DB対策は対象外
- 残課題: localStorageは端末内で平文保存（振込先等を含む）。共用PCでの利用は非推奨である旨をサイト上のプライバシー方針に明記すること（人間確認）
