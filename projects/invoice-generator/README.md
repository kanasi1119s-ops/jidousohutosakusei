# インボイス請求書ジェネレーター

適格請求書（インボイス）の記載事項に沿った請求書を作成し、ブラウザの印刷機能で PDF 保存できる、
**登録不要・オフライン対応・ブラウザ完結**の静的 Web サイトです（サイト形態: W1）。

- 入力データはこのブラウザ内（localStorage）にだけ保存され、外部へ送信されません（CSP `connect-src 'self'` で担保）。
- 税率（10% / 軽減8% / 非課税）ごとに集計し、消費税額は **1請求書あたり税率ごとに1回だけ** 端数処理します（国税庁Q&A準拠の仕様）。
- 税抜入力・税込入力（内税）、端数処理（切り捨て/四捨五入/切り上げ）を選べます。
- 保存した請求書の一覧、JSON バックアップ/復元、明細の CSV 出力（Excel でも化けない BOM 付き UTF-8）。
- PWA（一度開けばオフラインで動作）、スマホ幅（375px）〜PC幅（1280px 以上）対応。

## 開発

```bash
npm ci
npm run dev        # 開発サーバー
npm run check      # 型チェック
npm test           # ユニットテスト（Vitest）
npm run build      # 本番ビルド（dist/）
npm run test:e2e   # E2E（Playwright。初回は npx playwright install chromium）
npm run preview    # ビルド結果を確認
```

## データの保存場所

ブラウザの localStorage（キー `invoice-generator:state:v1`）。ブラウザのデータ消去や別端末では引き継がれません。
「全データをJSONでバックアップ」で必ず控えを取ってください。

## ドキュメント

- `docs/DESIGN.md` 要件・設計 / `docs/DEBUG_LOG.md` デバッグ3ラウンド記録
- `docs/SECURITY.md` / `docs/LEGAL.md` / `docs/THIRD_PARTY_LICENSES.md`
- `docs/RELEASE.md` 公開手順（人間向け） / `docs/REPORT.md` 日次レポート要約 / `docs/marketing/` 訴求文

> 免責: 本ツールは請求書作成の補助であり、税務・法律上の助言ではありません。
