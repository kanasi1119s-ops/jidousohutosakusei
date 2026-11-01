# 公開手順書（人間向け・未実行）
自動では実施していません。
1. 税務表記の確認（`docs/LEGAL.md` の★項目）
2. プライバシーポリシー・利用規約・（有料化するなら）特商法表記の確定
3. 公開先を決める: GitHub Pages / Cloudflare Pages など。Pages用ワークフローは現在 `income-wall-simulator` 用のみ（`.github/workflows/deploy-pages.yml`）。本プロジェクトを公開する場合は `projects/invoice-maker-jp` を対象にするか、`dist/` をZIPでアップロード。
4. `npm ci && npm run build` → `dist/` を配置（相対パスなのでサブディレクトリ可）
5. 公開後、実機で: オフライン動作、印刷→PDF保存、CSVをExcelで開いて日本語確認
ZIP作成例: `cd dist && zip -r ../invoice-maker-jp-dist.zip .`
