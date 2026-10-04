# 公開手順書（人間向・本番反映は未実施）
1. `npm ci && npm run verify` が通ることを確認
2. 法務: `docs/LEGAL.md` の「要人間確認」を解消（国税庁URLの確認、規約・特商法表記）
3. 静的ホスティングに `dist/` を配置（`npm run build`。`base: './'` のためサブディレクトリでも動作）
   - GitHub Pages: リポジトリ設定で Pages を有効化し、`.github/workflows/` にデプロイ用ワークフローを追加（有効化は人間）
   - Cloudflare Pages 等: ビルドコマンド `npm run build`、出力 `dist`、ルートは `projects/invoice-generator`
4. ZIP配布: `cd dist && zip -r ../invoice-generator-dist.zip .`（ファイル名は英数字のみ）
5. 公開後、オフライン動作と印刷/PDFを実機（スマホ含む）で確認
