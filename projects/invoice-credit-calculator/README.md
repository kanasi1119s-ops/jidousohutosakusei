# インボイス経過措置 仕入税額控除計算機（invoice-credit-calculator）

免税事業者等（適格請求書発行事業者以外）からの課税仕入れについて、**仕入日ごとの控除割合**
（〜2026/9/30: 80% → 2026/10/1〜: 70% → 2028/10/1〜: 50% → 2030/10/1〜: 30% → 2031/10/1〜: 0%）で
控除できる消費税額を一括試算するWebサイトです。

- サイト形態: **W1（静的サイト／ブラウザ完結・PWA）**。サーバー不要
- 登録不要・入力データは外部送信されません（CSPで外部通信を遮断）・オフラインでも動作
- データはブラウザの localStorage に保存。JSONバックアップ／CSVの入出力に対応

## 開発

```bash
npm ci
npm run dev        # 開発サーバー
npm run check      # 型チェック
npm test           # ユニットテスト(Vitest)
npm run build      # 静的ビルド（dist/）
npm run test:e2e   # E2E(Playwright)。初回は npx playwright install chromium
```

## データの保存場所
ブラウザの localStorage（キー `invoice-credit-calculator:state:v1`）。端末外には送信されません。
ブラウザのデータ削除で消えるため、定期的に「バックアップ(JSON)」を取ってください。

## 注意
税務上の助言ではありません。控除割合は令和8年度税制改正後の経過措置に基づく目安で、国税庁の一次情報での
最終確認が必要です（`docs/LEGAL.md`）。公開手順は `docs/RELEASE.md`。
