# セキュリティチェック（Phase 5）

- [x] `npm audit`: 0件（結果は REPORT.md に記録）
- [x] 秘密情報の混入: 検出なし（トークン/鍵パターンの grep）。`.env` は使用しない
- [x] OSSライセンス: `docs/THIRD_PARTY_LICENSES.md`。配布物（dist）に含まれるサードパーティコードはゼロ。開発ツールにコピーレフトなし（確認結果は同ファイル）
- [x] XSS: ユーザー入力は `textContent` / `setAttribute` 経由のみ。`innerHTML` は静的テンプレートのみ（E2Eでタグ文字列が文字として表示されることを検証）
- [x] インポート検証: `sanitizeInvoice` で型・長さ・列挙値・件数(100行/200件)を制限、ファイルは5MBまで
- [x] CSVインジェクション: `= + - @` 等で始まる文字列に `'` を前置
- [x] CSP: `default-src 'self'; connect-src 'self'` 等で外部通信を禁止（E2Eで外部リクエスト0件を検証）
- [x] W2 項目: 対象外（サーバーなし）

残課題: ホスティング側で HTTP ヘッダ（`X-Content-Type-Options` 等）を付与できる場合は付与を推奨。
