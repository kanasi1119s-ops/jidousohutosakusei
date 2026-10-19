# 公開手順書（人間が実行）

本リポジトリのCI/デプロイは未有効化です。以下は**人間の判断で**実施してください。

1. 法務・プライバシー方針・免責の最終確認（`docs/LEGAL.md` の★項目）
2. 静的ファイルの生成: `npm ci && npm run build` → `dist/` をアップロード（`base: './'` のためサブディレクトリでも動作）
3. ZIPで渡す場合: `cd dist && zip -r ../invoice-generator-dist.zip .`（ファイル名は英数字のみ）
4. ホスティング（GitHub Pages / Cloudflare Pages 等）を有効化。ワークフロー `.github/workflows/invoice-generator-ci.yml` は CI のみで、デプロイはしません
5. 公開後チェック: オフライン再読み込み、印刷プレビュー、スマホ幅表示
6. 独自ドメイン・販売・決済・SNS告知は人間が承認のうえ実施
