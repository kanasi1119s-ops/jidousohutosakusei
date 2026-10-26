# 公開手順書（人間が実行）
1. 法務チェック（docs/LEGAL.md の「要対応」）を完了し、必要ならプライバシー方針・利用規約を追加。
2. `npm ci && npm run check && npm test && npm run build && npm run test:e2e` が通ることを確認。
3. `dist/` を静的ホスティング（GitHub Pages / Cloudflare Pages 等）へ配置。`base: './'` のためサブディレクトリでも動作。
   ※ GitHub Pages の有効化・リポジトリ public 化は人間が判断する。
4. ZIP配布する場合は `cd dist && zip -r ../invoice-tax-simulator-dist.zip .`（英数字ファイル名）。
5. 制度改正（国税庁の最新情報）があれば `src/thresholds.ts` を更新して再ビルド。
