# 新NISA積立シミュレーター

毎月の積立額・想定利回り・期間から、新NISAの投資枠（年間・生涯）の上限を踏まえた将来評価額を試算する、
**登録不要・ブラウザ完結・オフライン対応**のWebサイトです（サイト形態: W1 静的サイト／PWA）。

## 機能
- つみたて投資枠／成長投資枠の毎月積立額・初期投資額・想定年利回り・期間から年次の推移を試算
- 年間投資枠（120万円／240万円）・生涯投資枠（1,800万円、うち成長1,200万円）で頭打ち＋警告表示
- 課税口座（税率20.315%）で同じ運用をした場合との差額の目安
- 設定のJSONエクスポート／インポート、結果のCSV（BOM付きUTF-8）ダウンロード
- 入力データはブラウザ内（localStorage）のみ。外部通信ゼロ（CSPで担保）

## 開発
```
npm install
npm run dev        # 開発サーバー
npm run check      # 型チェック
npm test           # ユニットテスト
npm run build      # 静的ビルド（dist/）
npm run test:e2e   # E2E（Playwright。事前に npx playwright install chromium）
```
データの保存場所: ブラウザの localStorage（キー `nisa-tsumitate-simulator:input:v1`）。
公開手順は `docs/RELEASE.md`。
