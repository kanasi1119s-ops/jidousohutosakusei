# 公開手順書（人間向け・本番反映は未実施）
1. 事前確認: `docs/LEGAL.md` の「要対応」をすべて解消（特に国税庁の一次情報との突合）
2. `npm ci && npm run check && npm test && npm run build`
3. 静的ホスティングへ配置（いずれも人間が実行）
   - GitHub Pages: Settings → Pages で `dist/` を配信するワークフローを有効化（本リポジトリの `deploy-pages.yml` は別プロジェクト用。本プロジェクト用は未作成）
   - Cloudflare Pages: ビルドコマンド `npm run build`、出力先 `dist`、ルートは `projects/invoice-tax-compare`
4. `base: './'` のためサブディレクトリ配置でも動作する
5. ZIP配布する場合: `cd dist && zip -r ../invoice-tax-compare-dist.zip .`（ファイル名は英数字のみ）
6. 公開後: オフライン動作（一度開いてから機内モード）を実機で確認
