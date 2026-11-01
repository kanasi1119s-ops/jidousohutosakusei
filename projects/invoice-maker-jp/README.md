# 請求書メーカー（インボイス対応） invoice-maker-jp

登録不要・オフライン対応のブラウザ完結Webサイト（サイト形態: **W1 静的サイト／PWA**）。
適格請求書（インボイス）の記載事項（発行者名・登録番号・発行日・税率ごとの税抜合計と消費税額）に沿った請求書を作成し、ブラウザの印刷機能でPDF保存できます。

- 入力データはブラウザの `localStorage` にのみ保存され、外部送信は一切ありません（CSPで `connect-src 'self'`）。
- 10% / 8%（軽減税率）の混在に対応。税額は「1請求書につき税率ごとに1回」端数処理（切り捨て・四捨五入・切り上げを選択）。
- CSV（BOM付きUTF-8）/ JSONバックアップのエクスポート、JSONインポート。

## 開発

```
npm ci
npm run dev        # 開発サーバー
npm run check      # 型チェック
npm test           # ユニットテスト(Vitest)
npm run build      # 型チェック + 静的ビルド(dist/)
npm run test:e2e   # E2E(Playwright。初回は npx playwright install chromium)
```

`dist/` は相対パス(`base: './'`)なので任意のサブディレクトリの静的ホスティングで動作します。

## データの保存場所
ブラウザの localStorage（キー `invoice-maker-jp:v1`）。消えると復元できないため、JSONバックアップを推奨します。

免責: 本ツールは税務・法律上の助言ではありません。詳細は `docs/LEGAL.md`。
