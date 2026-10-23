# インボイス特例 納税額比較

2割特例・3割特例・簡易課税・本則課税のうち、**消費税の納税額がいちばん少ない方式**を比べる、個人事業者向けのWebサイトです。

- サイト形態: **W1（静的サイト／ブラウザ完結PWA）**
- 登録不要・入力データは外部送信されません（CSPで外部通信を遮断）
- 一度開けばオフラインでも動作（Service Worker）
- 設定のJSONエクスポート/インポート、結果のCSV（BOM付きUTF-8）ダウンロード

> 一般的な試算であり、税務上の助言ではありません。詳細は `docs/LEGAL.md` を参照してください。

## 起動

```bash
npm ci
npm run dev          # 開発サーバー
npm run build        # dist/ に静的ファイルを出力
npm run preview      # ビルド結果の確認
```

## テスト

```bash
npm run check        # 型チェック
npm test             # ユニットテスト（Vitest）
npm run test:e2e     # E2E（Playwright。初回は npx playwright install chromium）
```

## データの保存場所

入力値はブラウザの `localStorage`（キー: `invoice-tax-compare:input:v1`）にのみ保存されます。

## ドキュメント

`docs/DESIGN.md` / `docs/DEBUG_LOG.md` / `docs/SECURITY.md` / `docs/LEGAL.md` / `docs/RELEASE.md` / `docs/REPORT.md` / `docs/marketing/`
