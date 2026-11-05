# 新NISA積立シミュレーター

積立額・想定年利・運用年数から、新NISAの将来評価額と課税口座との税額差を試算する**ブラウザ完結**の静的サイトです（サイト形態 W1）。登録不要・入力データは外部送信されず、オフラインでも動作します（PWA）。

## 起動・テスト・ビルド
```bash
npm ci
npm run dev        # 開発サーバー
npm run check      # 型チェック
npm test           # ユニットテスト(Vitest)
npm run test:e2e   # E2E(Playwright。初回は npx playwright install chromium)
npm run build      # dist/ に静的ファイルを出力
npm run preview    # ビルド結果の確認
```

## データの保存場所
ブラウザの localStorage のみ。設定はJSONで、結果はCSV(BOM付きUTF-8)でエクスポートできます。

## 免責
一般的な試算であり、投資勧誘・運用成果の保証・税務助言ではありません。詳細は `docs/LEGAL.md`。
