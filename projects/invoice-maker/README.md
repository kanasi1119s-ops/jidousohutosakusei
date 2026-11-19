# 請求書メーカー（invoice-maker）

登録不要・オフライン対応の、インボイス（適格請求書）対応 請求書作成ツールです。**サイト形態: W1（静的サイト／ブラウザ完結）**。

- 入力データは端末のブラウザ内（localStorage）にのみ保存され、外部送信されません（CSP `connect-src 'self'` で担保）
- 税率ごと（10% / 8% / 非課税）の合計と消費税額を、「1枚の請求書につき税率ごとに1回」の端数処理で計算
- 全角数字・カンマ入力に対応
- 印刷ダイアログから PDF 保存（外部ライブラリなし）
- 明細 CSV（BOM付きUTF-8）／バックアップ JSON のエクスポート・インポート
- PWA（一度開けばオフラインでも動作）、スマホ幅〜PC幅対応

## 起動・テスト

```bash
npm ci
npm run dev        # 開発サーバー
npm run check      # 型チェック
npm test           # ユニットテスト（Vitest）
npm run build      # 本番ビルド（dist/）
npm run preview    # ビルド結果の確認
npm run test:e2e   # E2E（Playwright。初回は npx playwright install chromium）
```

## データの保存場所

ブラウザの localStorage（キー `invoice-maker:draft:v1`）。ブラウザのデータ削除で消えるため、
画面の「バックアップ(JSON)」で定期的に保存してください。

## ドキュメント

`docs/DESIGN.md` / `docs/DEBUG_LOG.md` / `docs/SECURITY.md` / `docs/LEGAL.md` / `docs/RELEASE.md` / `docs/marketing/`
