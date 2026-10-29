# ふるさと納税 控除上限額シミュレーター

給与収入と家族構成から、自己負担2,000円で済むふるさと納税の寄付額上限の目安を試算する、ブラウザ完結のWebサイトです。

- サイト形態: **W1（静的サイト／ブラウザ完結、PWA）**。サーバー不要
- 登録不要・入力データは外部送信しない（CSPで外部通信を遮断）・オフラインでも動作
- 設定のJSONエクスポート/インポート、結果のCSV（BOM付きUTF-8）ダウンロード
- データの保存場所: ブラウザの localStorage のみ（キー `furusato-limit-simulator:input:v1`）

## 起動・テスト・ビルド

```bash
npm ci
npm run dev          # 開発サーバー
npm run check        # 型チェック
npm test             # ユニットテスト(Vitest)
npm run test:e2e     # E2E(Playwright, 初回は npx playwright install chromium)
npm run build        # dist/ に静的ファイルを出力（相対パスのためサブディレクトリ配置可）
```

## 制度値の更新

税制の数値は `src/rules.ts` に集約しています。改正時はこのファイルだけ更新してください。
計算式・前提・要確認事項は `docs/DESIGN.md` と `docs/LEGAL.md` を参照。
