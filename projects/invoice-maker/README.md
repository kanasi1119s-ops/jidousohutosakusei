# 請求書メーカー（適格請求書対応）

登録不要・オフライン対応・ブラウザ完結の請求書作成サイト（サイト形態: **W1 静的サイト/PWA**）。
入力データはブラウザ内（localStorage）にのみ保存され、外部には送信されません（CSPで外部通信を遮断）。

## 機能
- 発行者・請求先・明細（税率10%/8%混在可）の入力、プレビュー、印刷→PDF保存
- 登録番号（T+13桁）入力時のみ「適格請求書」表記。全角数字・ハイフン入力は自動正規化
- 消費税は**1請求書・税率ごとに1回**の端数処理（切捨て/四捨五入/切上げ選択）、税抜/税込単価に対応
- 請求書番号の自動採番、保存済み一覧、CSV(BOM付きUTF-8)出力、JSONバックアップ/復元
- PWA（一度開けばオフラインで動作）

## 開発
```
npm ci
npm run dev        # 開発サーバー
npm run check      # 型チェック
npm test           # ユニットテスト(Vitest)
npm run build      # 本番ビルド(dist/)
npm run test:e2e   # E2E(Playwright。初回は npx playwright install chromium)
```
データの保存場所: ブラウザの localStorage（キー `invoice-maker:data:v1`）。公開手順は `docs/RELEASE.md`。
