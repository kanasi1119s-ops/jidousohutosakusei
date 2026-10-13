# 公開手順（人間が実施）
1. リポジトリのpublic化を判断（現状private運用）
2. GitHub Pages を有効化する場合: Settings > Pages > Source: GitHub Actions。`.github/workflows/deploy-pages.yml` は income-wall-simulator 用のため、nisa-simulator 用に paths / working-directory / path を `projects/nisa-simulator` に変更した別ワークフローを用意する（未作成・本番反映は人間の承認後）
3. 静的ファイル一式のZIP: `npm ci && npm run build && cd dist && zip -r ../nisa-simulator-dist.zip .`
4. 公開前に docs/LEGAL.md の ★項目を確認
