# インボイス請求書ジェネレーター

適格請求書（インボイス）の記載事項に沿った請求書を、**登録不要・オフラインでも**ブラウザだけで作成するWebサイトです（サイト形態: W1 静的サイト／ブラウザ完結）。

- 入力データはこの端末のブラウザ内（localStorage）にのみ保存され、外部へ送信されません（CSPで `connect-src 'self'` に制限）
- 税率（10%／8%軽減）ごとの小計・消費税額、端数処理（切り捨て／四捨五入／切り上げ・税率ごとに1回）、源泉徴収税（10.21%／100万円超は超過分20.42%）に対応
- PDF保存はブラウザの印刷機能を使用（送信先「PDFに保存」）。CSVはBOM付きUTF-8（Excelで文字化けしません）
- 全データのJSON書き出し／読み込み（バックアップ）
- PWA（Service Worker）でオフライン動作

## 開発

```bash
npm ci
npm run dev        # 開発サーバー
npm run check      # 型チェック
npm test           # ユニットテスト（Vitest）
npm run build      # 型チェック + 静的ビルド（dist/）
npm run test:e2e   # E2E（Playwright。ビルドしてpreviewを起動します）
```

初回のE2E実行前に `npx playwright install chromium` が必要な場合があります。

## データの保存場所

ブラウザの localStorage（キー: `invoice-generator:data:v1`）。ブラウザのサイトデータを消すと失われるため、定期的に「全データをJSONで書き出し」でバックアップしてください。

## 構成

- `src/calc.ts` 計算・検証（税・端数処理・源泉・登録番号）
- `src/storage.ts` 保存・JSON入出力　`src/csv.ts` CSV出力
- `src/main.ts` UI　`public/sw.js` オフライン対応
- `docs/` 設計・テスト記録・法務/セキュリティ・公開手順・マーケ素材
