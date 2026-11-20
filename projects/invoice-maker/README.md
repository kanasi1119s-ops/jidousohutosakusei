# インボイス請求書メーカー（invoice-maker）

適格請求書（インボイス）の記載事項と「税率ごとに1回の端数処理」に対応した請求書を作る、**登録不要・オフライン対応・ブラウザ完結**のWebサイトです（サイト形態: W1 静的サイト）。

- 入力データはブラウザ内（localStorage）にのみ保存され、外部へ送信されません（CSPで外部通信を禁止）
- 10% / 8%（軽減税率）混在に対応。消費税額は税率ごとの小計に対して1回だけ端数処理（切り捨て/四捨五入/切り上げを選択）
- 必須記載事項（発行者名・登録番号・取引年月日・宛名・取引内容）の不足を警告表示
- 印刷 →「PDFとして保存」でPDF化（ブラウザ標準機能、外部ライブラリなし）
- 明細CSV（BOM付きUTF-8）、バックアップJSONの書き出し/読み込み
- PWA対応（一度開けばオフラインで動作）

## 開発

```bash
npm ci
npm run dev          # 開発サーバー
npm run check        # 型チェック
npm test             # ユニットテスト(Vitest)
npm run build        # dist/ に静的ファイルを出力
npm run test:e2e     # E2E(Playwright, 初回は npx playwright install chromium)
```

## データの保存場所
ブラウザの localStorage（`invoice-maker:*`）。ブラウザのデータ削除で消えるため、定期的に「バックアップ(JSON)」を書き出してください。

## 注意
本ツールは作成補助であり、税務・法律の助言ではありません。詳細は `docs/LEGAL.md`、公開手順は `docs/RELEASE.md`。
