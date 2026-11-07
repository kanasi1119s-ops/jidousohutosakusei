# セキュリティチェック（2026-11-07）
- [x] `npm audit`: 初回4件(moderate 2/high 2、開発ツールのみ)→ `npm audit fix --force` 後 **0件**。更新後も型チェック・ユニット14件・E2E 26件成功
- [x] 秘密情報: 代表的なトークン/秘密鍵パターンでリポジトリ全体を走査し検出なし（gitleaks未導入のため簡易走査）
- [x] OSSライセンス: `docs/THIRD_PARTY_LICENSES.md`。コピーレフト無し
- [x] XSS: ユーザー入力は `textContent`/`append(string)` のみで描画、`innerHTML` 不使用（E2Eで検証）
- [x] CSP: `default-src 'self'` ほか。`connect-src 'self'` により外部通信を遮断
- [x] インポート検証: JSON は型・長さ・数値範囲を `sanitizeInvoice` で補正、2MB上限
- [x] CSVインジェクション: 先頭が `= + - @` 等の文字列に `'` を付与
- [ ] W2ではないため認証/CSRF等は対象外
