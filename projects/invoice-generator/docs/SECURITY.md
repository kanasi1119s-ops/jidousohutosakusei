# セキュリティチェック（2026-11-24）
- [x] `npm audit`: 脆弱性 0件
- [x] 秘密情報: ソース・設定・テストに APIキー/トークン/パスワードなし（grep確認。gitleaks は環境に無いため未実施）
- [x] OSSライセンス: `docs/THIRD_PARTY_LICENSES.md`。本番バンドルへの実行時依存は0（devDependenciesのみ）。GPL/AGPLなし
- [x] XSS: ユーザー入力を含む innerHTML は全て `esc()` でエスケープ。E2Eで `<img onerror>` が実行されないことを確認
- [x] インポート検証: `parseAppData` で version・型・税率・数値を検証、不正は日本語メッセージで拒否
- [x] CSPで外部通信ゼロ（`default-src 'self'; connect-src 'self'`）。外部CDN/フォント/解析なし
- [x] CSVインジェクション対策（先頭 `= + - @` に `'` を付与）
- 注意: CSP は meta タグ方式。ホスティング側でHTTPヘッダ設定ができるなら併用が望ましい
