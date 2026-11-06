# セキュリティチェック記録（2026-11-06）

- [x] `npm audit`: 脆弱性 0 件（dev 含む／本番依存は空）
- [x] 秘密情報: 主要なトークン形式（ghp_ / github_pat_ / AKIA / sk- / 秘密鍵ヘッダー）をgrepで走査し検出なし（gitleaks は環境に無く未実施。人間側CIでの追加実行を推奨）
- [x] ライセンス: `docs/THIRD_PARTY_LICENSES.md` 参照（コピーレフトなし）
- [x] XSS: ユーザー入力は `textContent` / `createElement` のみで描画し `innerHTML` を使用していない（E2Eで `<img onerror>` 入力が実行されないことを確認）
- [x] CSP: `default-src 'self'; connect-src 'self'` 等により外部通信を技術的に遮断（`index.html`）
- [x] インポートJSON: 型・税率・件数(200)・サイズ(2MB)を検証し、不正なら拒否（単体テスト・E2E済）
- [x] CSVインジェクション: `=` `+` `@` 始まりのセルは先頭に `'` を付与（単体テスト済）
- [ ] 残課題: 入力データは localStorage に平文保存される（共有PCでの利用注意をREADMEに記載）
