# セキュリティ検査（Phase 5）

- [x] `npm audit`: **0件**（2026-10-05、開発依存のみ）
- [x] 秘密情報の混入: 本プロジェクトのファイルにAPIキー・トークン・個人情報なし（`grep` による確認。`.env` 不使用）
- [x] OSSライセンス: `docs/THIRD_PARTY_LICENSES.md`
- [x] XSS: ユーザー入力は `textContent` または数値化した値のみ画面に反映。`innerHTML` は固定テンプレート（定数のみ）に限定。
      結果の備考欄も `textContent` で挿入。
- [x] インポート検証: JSONは型・長さ・年分の範囲を厳密検証（`src/storage.ts`）。不正な場合はエラー表示のみで状態を変更しない。
- [x] CSP: `default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'` 等。E2Eで外部ドメインへの通信ゼロを検証。
- [x] W2項目（認証・CSRF等）: W1のため対象外。
