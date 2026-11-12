# セキュリティチェック（2026-11-12）

- [x] `npm audit`: 0件（開発依存のみ。本番配布物に依存パッケージはゼロ）
- [x] 秘密情報の混入: APIキー/トークン/秘密鍵の典型パターンをgrepで検査、検出なし（gitleaksは環境に無く未使用）
- [x] OSSライセンス: 開発依存のみ。MIT/ISC/BSD/Apache-2.0が大半。MPL-2.0（lightningcss、Viteのビルド時のみ使用・配布物に含まれない）。GPL/AGPLなし → `THIRD_PARTY_LICENSES.md`
- [x] XSS: ユーザー入力は textContent / value 経由のみ。`innerHTML` は固定テンプレート1箇所（ユーザー入力を含まない）。E2Eで `<img onerror>` が実行されないことを確認
- [x] インポート: `parseBackup` で型・長さを検証し無害化（件数・文字数上限、型不正は既定値）
- [x] CSV: 先頭が `= + - @` の文字列は `'` を付与し式として解釈されないようにした
- [x] CSP: `default-src 'self'` ほか外部通信を禁止（connect-src 'self'）
- 残課題: localStorageは平文保存（端末を共有する場合は注意。README/プライバシー方針案で明記）
