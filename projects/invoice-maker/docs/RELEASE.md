# 公開手順（人間が実行）
**本番反映は自動では行っていません。**
1. 公開判断（リポジトリのpublic化・Pages有効化は人間）
2. GitHub Pages: リポジトリ Settings → Pages → Source を「GitHub Actions」にする。`.github/workflows/invoice-maker-deploy-pages.yml` を手動実行（workflow_dispatch）
3. または `npm run build` → `dist/` を静的ホスティングへアップロード（相対パス `base:'./'` のためサブディレクトリでも動作）
4. ZIP配布: `cd dist && zip -r ../invoice-maker-dist.zip .`
5. 公開前に `docs/LEGAL.md` の要対応項目を確認

注意: GitHub Pagesは1リポジトリに1サイトのみです。既存の `deploy-pages.yml`（年収の壁シミュレーター）と排他になるため、本プロジェクトのデプロイワークフローは手動実行のみにしています。どちらを公開するかは人間が決めてください（別リポジトリへの分離も選択肢）。
