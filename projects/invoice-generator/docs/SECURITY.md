# セキュリティチェック（2026-11-16）

- [x] `npm audit`: 0件
- [x] 秘密情報の混入: src / e2e / public / docs を検索し該当なし（APIキー・トークン等を使用しない設計）
- [x] OSSライセンス: 本番配布物に含まれる依存パッケージはゼロ（実行時コードは自作のみ）。開発ツールは MIT / Apache-2.0 / ISC / BSD / MPL-2.0 / MIT-0 で、GPL/AGPL なし → `docs/THIRD_PARTY_LICENSES.md`
- [x] XSS: ユーザー入力は `textContent`／`value` のみ。E2Eで `<img onerror>` を入力しても実行されないことを確認
- [x] CSP: `default-src 'self'; connect-src 'self'` で外部通信を遮断
- [x] インポートJSON: `normalizeStore` で型・長さ・件数を制限。不正形式は拒否（E2E確認）
- [x] CSV数式注入: 先頭が `= + @` または数字以外が続く `-` のセルにアポストロフィを付与（ユニットテスト）
- W2要素なし（認証・CSRF等は対象外）
