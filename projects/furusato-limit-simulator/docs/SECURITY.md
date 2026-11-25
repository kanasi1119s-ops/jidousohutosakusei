# セキュリティチェック（2026-11-25）
- [x] `npm audit`: 初期4件(high 2/moderate 2, 開発ツール)→ `npm audit fix` で **0件**
- [x] 秘密情報: ソース・履歴にAPIキー/トークン/秘密鍵パターンなし（gitleaks未導入のためgrepで確認。CI導入は推奨）
- [x] OSSライセンス: `docs/THIRD_PARTY_LICENSES.md`。配布物（dist）に同梱される依存はなし（バンドルは自作コードのみ）。GPL/AGPL/SSPLなし
- [x] XSS: ユーザー入力は数値化してから表示。エラーは `textContent`。`innerHTML` は固定文字列と数値整形結果のみ
- [x] インポート: `coerceInput` で型・列挙値を厳格に検証、不正時は拒否
- [x] CSP: `default-src 'self'` ほか。外部通信ゼロ（connect-src 'self'）
- [x] CSV: 先頭が `= + - @` の文字列は無害化（現状は固定ラベルと数値のみ）
- 残課題: gitleaks等のCI組込み、Dependabot設定（任意）
