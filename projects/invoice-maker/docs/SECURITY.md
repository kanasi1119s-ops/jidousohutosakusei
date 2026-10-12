# セキュリティ検査記録（2026-10-12）

- [x] `npm audit`: 脆弱性 0件
- [x] 秘密情報の混入: ソース・設定・ドキュメントに APIキー／トークン／秘密鍵のパターンなし（grep による確認。gitleaks は環境に未導入のため未実施。公開前に人間側で `gitleaks` 等の実行を推奨）
- [x] OSSライセンス一覧: `docs/THIRD_PARTY_LICENSES.md`
- [x] ユーザー入力の扱い
  - `innerHTML` / `outerHTML` / `insertAdjacentHTML` / `eval` / `new Function` / `document.write` を一切使用していない（DOM API と `textContent` のみ）
  - E2E: `<img onerror>` を入力しても実行されず文字として表示されることを確認
  - インポートJSONは型・範囲・長さ・税率の値を検証（`sanitizeInvoice`）。不正なファイルは拒否し既存データを壊さない
  - CSV: 先頭が `= + - @` 等のセルにアポストロフィを付与（Excel式インジェクション対策）
- [x] Content-Security-Policy: `default-src 'self'` 他で外部通信ゼロを担保（`connect-src 'self'`）。インラインstyle違反はRound 3で修正し、E2Eで監視
- [x] W2（サーバー付き）対策: 該当なし（W1）

## 残課題
- localStorage は端末・ブラウザ内で平文保存。共用PCでの利用時は「保存した請求書」を削除するよう利用者へ案内が必要（`docs/LEGAL.md` のプライバシー方針案に記載）
