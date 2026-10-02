# 公開手順書（人間が実行）
1. `npm ci && npm run check && npm test && npm run build`
2. `dist/` は相対パス(`base: './'`)のため、GitHub Pages のサブパス・Cloudflare Pages・任意の静的ホスティングにそのまま置ける
3. 公開前に `docs/LEGAL.md` の★項目を確認
4. 公開方法の例: Cloudflare Pages（ビルドコマンド `npm run build`、出力 `dist`、ルート `projects/invoice-generator`）/ GitHub Pages（Pagesワークフローは未作成。既存 `deploy-pages.yml` を参考に追加し、Pages有効化は人間が行う）
5. ZIP化: `cd dist && zip -r ../invoice-generator-dist.zip .`（ファイル名は英数字のみ）
