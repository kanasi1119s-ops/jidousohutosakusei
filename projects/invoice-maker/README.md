# インボイス対応 請求書メーカー

適格請求書（インボイス）の記載事項に沿った請求書を作る、**登録不要・オフライン対応のブラウザ完結Webサイト**です（サイト形態: W1 静的サイト）。

- 入力データはすべてブラウザ内（localStorage）に保存され、外部へ送信されません（CSPで外部通信を禁止）
- 税率別（10% / 8%軽減 / 非課税）の対価・消費税額を自動計算（1請求書・税率ごとに1回の端数処理、切捨て/四捨五入/切上げ）
- 税抜入力・税込入力に対応、源泉徴収税額（10.21% / 100万円超の部分は20.42%）の差し引きに対応
- 適格請求書の記載事項チェック、印刷 / PDF保存（ブラウザの印刷機能）
- 請求書の複数保存・複製、JSONバックアップ/復元、請求書一覧のCSV書き出し（BOM付きUTF-8、Excelで開いても文字化けしません）
- PWA対応（一度開けばオフラインでも動作）、スマホ幅〜PC幅のレスポンシブ

> 本ツールは作成補助であり、税務・法律上の助言ではありません。

## 開発

```bash
npm ci            # 依存インストール
npm run dev       # 開発サーバー
npm run check     # 型チェック
npm test          # ユニットテスト（Vitest）
npm run build     # 型チェック + 静的ビルド（dist/）
npm run preview   # ビルド結果の確認
npx playwright install chromium   # 初回のみ（E2E用ブラウザ）
npm run test:e2e  # E2Eテスト（Playwright、デスクトップ/モバイル）
```

## データの保存場所
ブラウザの localStorage（キー `invoice-maker:data:v1`）。ブラウザのデータ消去・端末変更で失われるため、画面の
「バックアップ（JSON）」で定期的に保存してください。

## 構成
`src/calc.ts`（税計算）/ `src/invoice.ts`（データモデル・検証・記載事項チェック）/ `src/csv.ts` / `src/storage.ts` / `src/main.ts`（UI）。
設計は `docs/DESIGN.md`、公開手順は `docs/RELEASE.md`、法務は `docs/LEGAL.md` を参照。
