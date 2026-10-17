# セキュリティチェック（Security）

- [x] `npm audit`: 0件（初期状態で source-map-js の high 1件 → `npm audit fix` で解消）
- [x] 秘密情報: APIキー等なし。`.env` 不使用
- [x] OSSライセンス: `docs/THIRD_PARTY_LICENSES.md`
- [x] XSS: ユーザー入力は `innerHTML` に埋め込まず、数値化して整形した値のみ表示。エラーは `textContent`
- [x] インポート検証: JSON構文・型を検証。不正ならエラー表示
- [x] CSP: `default-src 'self'; connect-src 'self'` 等で外部通信を遮断
- [ ] 残課題: なし（W2要素なし）
