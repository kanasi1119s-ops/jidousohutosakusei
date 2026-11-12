# 請求書ジェネレーター（invoice-generator）

インボイス（適格請求書）の記載事項に対応した請求書を作成し、PDFとして保存・印刷できる、**ブラウザ完結**のWebサイトです。

- サイト形態: **W1（静的サイト／ブラウザ完結・PWA）**。サーバー不要
- 入力データは**端末のブラウザ内（localStorage）にのみ保存**。外部通信はゼロ（CSPで担保、外部CDN・Webフォントなし）
- 登録不要・オフラインでも動作（Service Worker）

## 機能
- 発行者（登録番号 T+13桁）・請求先・明細（税率10%/8%）の入力、リアルタイムプレビュー
- 消費税は「1請求書につき税率ごとに1回」端数処理（切り捨て/四捨五入/切り上げを選択）
- 全角数字・カンマ入力に対応
- 保存済み請求書の一覧・再編集・削除、請求書番号の自動採番
- 印刷 / PDFで保存（ブラウザの印刷機能。A4向けの印刷用CSS）
- CSV書き出し（Excel対応のBOM付きUTF-8）、バックアップJSONの書き出し/読み込み

## 開発
```bash
npm ci
npm run dev        # 開発サーバー
npm run check      # 型チェック
npm test           # ユニットテスト（Vitest）
npm run build      # 型チェック + 静的ビルド（dist/）
npm run preview    # ビルド結果の確認
npm run test:e2e   # E2E（Playwright。初回は `npx playwright install chromium`）
```

## データの保存場所
ブラウザの localStorage（キー `invoice-generator:v1`）。ブラウザのサイトデータを消去すると失われるため、
画面の「バックアップ(JSON)を書き出し」で定期的に保存してください。

## ドキュメント
`docs/DESIGN.md` / `docs/DEBUG_LOG.md` / `docs/SECURITY.md` / `docs/LEGAL.md` / `docs/RELEASE.md` / `docs/REPORT.md` / `docs/marketing/`
