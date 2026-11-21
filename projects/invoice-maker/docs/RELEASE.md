# 公開手順書（人間が実施）
1. 利用規約・プライバシーポリシー・LICENSEを確認
2. `npm ci && npm run build` → `dist/` が静的サイト一式（`base: './'` のためサブディレクトリでも動作）
3. 公開先を選び有効化（GitHub Pages / Cloudflare Pages 等）。本リポジトリは自動デプロイしない設定
4. ZIP配布する場合: `cd dist && zip -r ../invoice-maker-dist.zip .`
5. 公開後、オフライン動作（初回表示後に機内モードで再読込）を確認
