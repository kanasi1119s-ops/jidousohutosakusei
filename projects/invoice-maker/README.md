# インボイス請求書メーカー（invoice-maker）

インボイス制度の記載事項（登録番号・税率ごとの対象額と消費税額）に沿った請求書を作成し、印刷／PDF保存できる
**ブラウザ完結の静的Webサイト（W1）** です。登録不要・オフライン対応・入力データは外部送信されません。

## 起動・テスト・ビルド
```
npm ci
npm run dev        # 開発サーバー
npm run check      # 型チェック
npm test           # ユニットテスト(Vitest)
npm run test:e2e   # E2E(Playwright。初回は npx playwright install chromium)
npm run build      # dist/ に静的ファイルを出力
npm run preview    # ビルド結果を配信して確認
```

## データの保存場所
ブラウザの localStorage（キー `invoice-maker:state:v1`）。「全データをエクスポート(JSON)」でバックアップできます。
外部通信は行いません（CSPで `connect-src 'self'` に制限）。

## 免責
一般的な計算ツールであり、税務・法律上の助言ではありません。詳細は `docs/LEGAL.md`。
