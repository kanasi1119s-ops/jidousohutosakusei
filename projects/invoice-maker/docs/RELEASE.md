# 公開手順（人間が実施。本番反映はオーケストレーターでは行っていません）
1. 最終確認: docs/LEGAL.md の「要人間確認」項目を解消
2. ビルド: `npm ci && npm run build` → `dist/`（`base: './'` のためサブディレクトリ配置可）
3. 公開方法の例
   - GitHub Pages: リポジトリ設定でPagesを有効化し、`.github/workflows/invoice-maker-pages.yml` を手動実行（workflow_dispatch）
   - Cloudflare Pages 等: `dist/` をアップロード
   - ZIP配布: `cd dist && zip -r ../invoice-maker-dist.zip .`
4. 公開後: https配信であることを確認（Service Worker に必要）。オフラインで開けることを確認
5. 独自ドメイン・販売ページ・SNS告知は人間が判断
