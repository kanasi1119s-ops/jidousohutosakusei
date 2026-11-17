# 公開手順書（人間が実行）
1. `npm ci && npm run build` → `dist/` が静的ファイル一式（`base: './'` のためサブディレクトリ配置可）
2. 配布ZIP: `cd dist && zip -r ../invoice-generator-dist.zip .`
3. ホスティング（いずれも**人間が有効化**）: GitHub Pages / Cloudflare Pages 等。リポジトリのpublic化判断も人間。
4. 公開前チェック: `docs/LEGAL.md` の★項目、実機（iOS Safari / Android Chrome）で印刷プレビューとオフライン動作を確認
5. 本リポジトリの `.github/workflows/deploy-pages.yml` は income-wall-simulator 用。本プロジェクトを公開する場合はワークフローの対象ディレクトリを調整すること
