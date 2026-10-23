# セキュリティ検査記録（2026-10-23）
- [x] `npm audit`: 初回 4件（moderate 2 / high 2、開発ツールのみ）→ `npm audit fix` で **0件**。修正後に全テスト成功を確認
- [x] 秘密情報: ソース・docs に APIキー/トークン/パスワードの記載なし
- [x] OSSライセンス: `docs/THIRD_PARTY_LICENSES.md`。本番配布物の実行時依存はゼロ。GPL/AGPL/LGPL なし
- [x] 入力の扱い: ユーザー入力を `innerHTML` に埋め込まない（表示文字列は固定の文言と計算結果の数値のみ）。JSONインポートは型検証し、未知キーは破棄
- [x] CSP: `default-src 'self'; connect-src 'self'` 等で外部通信を遮断（index.html）
- [ ] W2ではないため認証/CSRF等は対象外
- 残課題: なし（`gitleaks` は環境にないため grep による簡易確認）
