# セキュリティチェック

- [x] `npm audit`: 下記参照
- [x] 秘密情報: コミット対象にキー・トークン・個人情報なし（Phase 5で grep 検査）
- [x] OSSライセンス: docs/THIRD_PARTY_LICENSES.md
- [x] XSS: ユーザー入力値は `innerHTML` に埋め込まない（結果表は数値の整形文字列と固定ラベルのみ）。JSONインポートは型検証。
- [x] CSP: `default-src 'self'; connect-src 'self'` で外部通信を遮断。
- W2要件（認証・CSRF等）: 該当なし。

## 実施結果（2026-10-29）
- `npm audit`: 脆弱性 0 件
- 秘密情報検査: `grep -rEi "(api[_-]?key|secret|token|password|BEGIN .*PRIVATE)"` で検出なし
