# 公開手順書（人間が実施）
本番反映はすべて人間が判断・実施します。
1. `docs/LEGAL.md` の「要人間確認」を解消（特に控除割合の国税庁一次情報確認）
2. リポジトリのpublic化を判断
3. 静的ホスティングを選ぶ（GitHub Pages / Cloudflare Pages 等）
   - 手動: `npm ci && npm run build` → `dist/` の中身を配置。`base: './'` のためサブディレクトリ配置でも動作（確認済み）
   - GitHub Pages: 既存の `.github/workflows/deploy-pages.yml` は income-wall-simulator 用。1リポジトリ=1 Pages のため、どのサイトを公開するか決めて workflow を調整（Pagesの有効化は人間）
4. ZIPで渡す場合: `cd dist && zip -r ../invoice-credit-calculator-dist.zip .`
5. 独自ドメイン・告知は人間が判断
