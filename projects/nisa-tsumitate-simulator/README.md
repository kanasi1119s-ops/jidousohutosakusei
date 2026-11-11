# NISA積立シミュレーター

毎月の積立額・想定利回り・期間から、将来の資産額とNISA非課税枠（成人NISA／こどもNISA）の使用状況、課税口座との差の目安を試算する、**ブラウザ完結・登録不要・オフライン対応**の静的サイトです（サイト形態: W1）。

## 起動・テスト
```
npm ci
npm run dev        # 開発サーバー
npm run check      # 型チェック
npm test           # ユニットテスト（Vitest）
npm run build      # 静的ビルド（dist/）
npm run test:e2e   # E2E（Playwright。初回は npx playwright install chromium）
```
## データの保存場所
入力値はブラウザの localStorage のみ。外部送信なし（CSPで `connect-src 'self'`）。JSON/CSVでエクスポート／インポート可能。CSVはBOM付きUTF-8。

## 注意
試算は仮定に基づく簡易計算であり、投資助言ではありません。制度数値は `src/rules.ts` で管理しており、公開前に金融庁の最新情報で確認してください。
