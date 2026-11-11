# セキュリティチェック
- [x] `npm audit`: 0件
- [x] 秘密情報: 検出なし（キー・トークン類なし。外部通信なし）
- [x] OSSライセンス: 本番配布物に実行時依存ゼロ。THIRD_PARTY_LICENSES.md 参照
- [x] XSS: ユーザー入力文字列をHTMLへ埋め込まない（数値のみ描画）。innerHTMLは固定文言と数値のみ
- [x] CSP: `default-src 'self'; connect-src 'self'` で外部通信を遮断
- [x] JSONインポート: 型・有限数を検証
