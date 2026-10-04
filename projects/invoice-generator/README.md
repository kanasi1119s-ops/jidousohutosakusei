# 請求書ジェネレーター（invoice-generator）

インボイス（適格請求書）の記載事項に対応した請求書を作る、**ブラウザ完結・登録不要・オフライン対応**のWebサイトです（サイト形態 W1）。

- 入力データはブラウザ（localStorage）にのみ保存され、外部へ送信されません（CSPで外部通信を遮断）
- 税率（10% / 8%）ごとの小計・消費税額を区分表示。端数処理は「税率ごとに1請求書1回」
- 登録番号（T+13桁）の形式チェック、軽減税率対象の「※」表示、任意で源泉徴収（目安）
- 印刷 / PDF保存（ブラウザの印刷機能）、明細CSV（BOM付きUTF-8）、JSONバックアップ／復元
- PWA対応（一度開けばオフラインでも動作）、スマホ幅〜PC幅のレスポンシブ

## 開発

```bash
npm ci
npm run dev        # 開発サーバー
npm run check      # 型チェック
npm test           # ユニットテスト(Vitest)
npm run build      # 型チェック + 静的ビルド（dist/）
npm run test:e2e   # E2E(Playwright)。初回は npx playwright install chromium
npm run verify     # check + test + test:e2e
```

## データの保存場所
- 下書き: `localStorage` の `invoice-generator:draft:v1`
- 保存済み請求書: `localStorage` の `invoice-generator:saved:v1`
- ブラウザのデータ消去で失われるため、画面の「バックアップ保存(JSON)」で控えを取ってください。

## ドキュメント
`docs/DESIGN.md` / `docs/DEBUG_LOG.md` / `docs/SECURITY.md` / `docs/LEGAL.md` / `docs/RELEASE.md` / `docs/marketing/` / `docs/REPORT.md`
