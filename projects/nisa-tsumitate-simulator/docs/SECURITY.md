# セキュリティチェック

- [x] `npm audit`: 初回に moderate/high 検出（vite・vitest・source-map-js、開発ツールのみ）→ `npm audit fix` で **0件**に解消、全テスト再成功
- [x] 秘密情報: 鍵・トークン様の文字列をgrepで検査、検出なし（gitleaks未導入のため簡易検査）
- [x] ライセンス: `docs/THIRD_PARTY_LICENSES.md`
- [x] XSS: `innerHTML` は固定テンプレート1箇所のみ（ユーザー入力非含有）。結果表示は `textContent`/DOM API。JSONインポートは数値型・有限値を検証
- [x] CSP: `default-src 'self'; connect-src 'self'` 等で外部通信ゼロを担保
- [x] 外部CDN・Webフォント不使用
