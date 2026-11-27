# 新NISA積立シミュレーター

積立額・想定年利・期間から、新NISAの**投資枠上限（年360万円／生涯1,800万円）**を考慮した資産推移を試算するWebサイトです（サイト形態: W1 静的・ブラウザ完結）。

- 登録不要・入力データは外部送信しません（CSPで外部通信を遮断）
- PWA対応で、一度開けばオフラインでも動作
- 課税口座（税率20.315%）で運用した場合との差、インフレ調整後の実質価値、目標金額からの月額逆算
- 設定のJSONエクスポート/インポート、年次表のCSV（BOM付きUTF-8）ダウンロード

## 起動・テスト・ビルド

```bash
npm ci
npm run dev          # 開発サーバー
npm run check        # 型チェック
npm test             # ユニットテスト（Vitest）
npm run test:e2e     # E2E（Playwright。初回は npx playwright install chromium）
npm run build        # dist/ に静的ファイルを出力
npm run preview      # ビルド結果を配信して確認
```

## データの保存場所
入力値はブラウザの localStorage のみ（キー: `nisa-tsumitate-simulator:input:v1`）。サーバー送信なし。

## 免責
一般的な試算であり、投資助言ではありません。将来の成果を保証しません。詳細は `docs/LEGAL.md`。
