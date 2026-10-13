# 新NISA積立シミュレーター

積立額・成長投資枠・想定利回り・コストから、将来の評価額と非課税メリットの目安を試算するブラウザ完結Webサイト（サイト形態: W1）。

- 登録不要 / 入力データは外部送信なし（CSPで担保）/ PWAでオフライン動作
- データ保存先: ブラウザの localStorage（設定のJSONエクスポート/インポート、結果のCSV出力あり）

## 開発
```
npm ci
npm run dev        # 開発サーバー
npm run check      # 型チェック
npm test           # ユニットテスト
npm run build      # 静的ビルド (dist/, 相対パス)
npm run test:e2e   # Playwright (要 npx playwright install chromium)
```
公開手順は `docs/RELEASE.md`。
