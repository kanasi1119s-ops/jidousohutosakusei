# 公開手順書（人間が実施）
1. 法務確認: docs/LEGAL.md の「要人間確認」を完了
2. ビルド: `npm ci && npm run build` → `dist/` が公開物（相対パスのためサブディレクトリ配置可）
3. ホスティング（いずれか）
   - Cloudflare Pages / Netlify: `dist/` をアップロード（無料枠で可）
   - GitHub Pages: このモノレポではPagesが年収の壁シミュレーターと競合するため、**別リポジトリに切り出す**か `dist/` のみを別リポジトリへ配置
   - 手動配布: `cd dist && zip -r ../invoice-maker-dist.zip .`
4. 公開後確認: 初回表示→オフラインで再読み込み→請求書作成→印刷でPDF保存
5. 独自ドメイン・public化・広告/SNS告知は人間の判断（本ツールでは実施しない）
