# 請求書メーカー（invoice-maker）

適格請求書（インボイス）の記載事項に沿った請求書を作る、**登録不要・オフライン対応**のブラウザ完結Webサイトです（サイト形態: W1 静的サイト）。

- 入力データはブラウザ内（localStorage）にのみ保存。外部通信ゼロ（CSPで担保）。
- 税率（10%/8%）ごとに集計し、消費税額は税率ごとに1回だけ端数処理（切り捨て/四捨五入/切り上げを選択）。
- 印刷/PDF保存（ブラウザの印刷機能）、CSV（BOM付きUTF-8）、JSONバックアップ/インポート。
- PWA対応（一度開けばオフラインで動作）、スマホ幅〜PC幅対応。

## 開発
```bash
npm ci
npm run dev        # 開発サーバー
npm run check      # 型チェック
npm test           # ユニットテスト (Vitest)
npm run build      # 静的ビルド (dist/)
npm run test:e2e   # E2E (Playwright。初回は npx playwright install chromium)
```
データの保存場所: ブラウザの localStorage（キー `invoice-maker:draft:v1`）。ブラウザのデータ消去で失われるためJSONバックアップを推奨します。
公開手順は `docs/RELEASE.md`、設計は `docs/DESIGN.md` を参照。

## 免責
一般的な作成補助ツールであり、税務・法律上の助言ではありません。
