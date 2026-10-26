# 消費税 納税額シミュレーター（invoice-tax-simulator）

2割特例の終了後、個人事業者が「3割特例（2027・2028年分）／2割特例（2026年分）・簡易課税・原則課税」の
どれで消費税の納税額が小さくなるかを比較する、**ブラウザ完結の静的サイト（W1）**です。

- 登録不要・入力データは外部送信されません（CSPで外部通信を禁止）
- PWA対応でオフラインでも動作
- 設定のJSONエクスポート/インポート、結果のCSV（BOM付きUTF-8）ダウンロード
- データの保存場所: ブラウザの localStorage（この端末のみ）

> 制度の数値・要件は、国税庁の一次資料を直接確認できていない状態で作成した目安です。公開前に
> `docs/LEGAL.md` の確認事項を必ず実施してください。

## 開発

```bash
npm install
npm run dev        # 開発サーバー
npm run check      # 型チェック
npm test           # ユニットテスト（Vitest）
npm run build      # 静的ビルド（dist/）
npm run test:e2e   # E2E（Playwright。事前に npx playwright install chromium）
```

制度パラメータは `src/thresholds.ts` のみを更新すれば画面全体に反映されます。

## ドキュメント
`docs/DESIGN.md` / `docs/DEBUG_LOG.md` / `docs/SECURITY.md` / `docs/LEGAL.md` /
`docs/THIRD_PARTY_LICENSES.md` / `docs/RELEASE.md` / `docs/REPORT.md` / `docs/marketing/`
