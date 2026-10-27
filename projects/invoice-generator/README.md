# 適格請求書ジェネレーター（invoice-generator）

登録不要・オフラインでも使える、ブラウザ完結の請求書作成サイトです。入力内容はこのブラウザの外へ送信されません。

- **サイト形態**: W1（静的サイト／ブラウザ完結のPWA）。サーバー不要
- **主な機能**: 税率（10%／軽減8%／非課税等）ごとの消費税計算、税抜／税込入力、端数処理（切捨て／四捨五入／切上げ・税率ごとに1回）、適格請求書の記載事項チェック、源泉徴収税額の計算、印刷によるPDF保存、請求書の保存、JSONバックアップ、CSV出力
- **データの保存場所**: ブラウザの localStorage のみ（キー `invoice-generator:data:v1`）。外部通信は CSP で禁止しています

## 起動

```bash
npm install
npm run dev        # 開発サーバー
```

## 検証・ビルド

```bash
npm run check      # 型チェック
npm test           # ユニットテスト（Vitest）
npm run build      # 型チェック + 静的ビルド（dist/）
npm run test:e2e   # E2E（Playwright。初回は `npx playwright install chromium`）
npm run preview    # dist/ を配信して確認
```

## ドキュメント

- `docs/DESIGN.md` 要件・データモデル・スコアリング
- `docs/DEBUG_LOG.md` デバッグ3ラウンド記録
- `docs/SECURITY.md` / `docs/THIRD_PARTY_LICENSES.md` / `docs/LEGAL.md`
- `docs/RELEASE.md` 公開手順（人間向け）
- `docs/marketing/` LP・商品説明・SNS文案
- `docs/REPORT.md` 日次レポート要約

文字コードはすべて UTF-8（BOMなし・LF）です。ダウンロードする CSV のみ、Excel で開いても化けないよう BOM 付き UTF-8 で出力します。
