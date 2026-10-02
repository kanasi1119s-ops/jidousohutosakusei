# セキュリティチェック（2026-10-02）
- [x] `npm audit`: 0件
- [x] 秘密情報: 検出なし（APIキー等を一切使用しない。`gitleaks` 未導入のため grep による目視確認）
- [x] OSSライセンス: 本番配布物の依存はゼロ（vanilla TS + 自前コード）。開発ツールは MIT/Apache-2.0/ISC/BSD/MPL-2.0(lightningcss, ビルド時のみ・非同梱)。GPL/AGPL なし → `THIRD_PARTY_LICENSES.md`
- [x] XSS: ユーザー入力は `textContent`/`append(string)` のみで描画（`innerHTML` 不使用）。E2Eで検証
- [x] インポートJSON: schema検証・型/長さ/数値範囲のサニタイズ（`sanitizeInvoice`）
- [x] CSP: `default-src 'self'; connect-src 'self'` 等で外部通信を禁止
- W2の項目: 該当なし（サーバーなし）
