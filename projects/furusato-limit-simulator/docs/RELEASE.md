# 公開手順書（人間向け・本番反映は未実施）

1. `npm ci && npm run check && npm test && npm run build` で `dist/` を生成（`base: './'` のためサブディレクトリ配置可）
2. 一次情報の確認（docs/LEGAL.md）と利用規約・プライバシーポリシーの確定
3. 公開先を選ぶ: GitHub Pages（ワークフロー `.github/workflows/deploy-pages.yml` は income-wall 用。本プロジェクトを公開する場合は同様のワークフローを追加し、
   Pages を有効化）/ Cloudflare Pages 等。**有効化・public化は人間が判断**
4. 静的ファイル一式のZIP: `cd dist && zip -r ../furusato-limit-simulator-dist.zip .`
5. 公開後、オフライン動作（一度開いて機内モードで再読み込み）を実機で確認
6. 年次更新: 制度改正（毎年）に合わせ `src/calc.ts` の控除額と `AS_OF` を更新
