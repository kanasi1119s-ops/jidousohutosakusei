# セキュリティチェック（Phase 5）
- [x] `npm audit`: 下記実行結果参照（脆弱性0件を確認、AUDIT_RESULT 参照）
- [x] 秘密情報: コード・履歴にAPIキー等なし（`grep`で確認。外部サービス未使用）
- [x] OSSライセンス: `docs/THIRD_PARTY_LICENSES.md`（本番バンドルに含まれる依存は無し。devDependenciesのみ）
- [x] XSS: `innerHTML` 不使用（DOMビルダー経由の textContent のみ）。E2Eで `<img onerror>` が無害であることを確認
- [x] CSP: `default-src 'self'` + `connect-src 'self'`（外部通信ゼロを技術的に担保）
- [x] インポート検証: 型・範囲・件数・税率値を検証、不正は拒否（ユニット/E2E）
- [x] CSVインジェクション: `= + - @` 始まりを `'` で無害化（ユニット/E2E）
- 残課題: なし（W2非該当）
