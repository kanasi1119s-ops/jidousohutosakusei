# 公開手順書（人間向け・未実行）
本オーケストレーターは本番反映をしていません。以下は人間が実施します。
1. 事前確認済み: build成功、ユニット11件・E2E26件成功、dist を静的配信して表示確認、`npm audit` 0件。
2. `docs/LEGAL.md` の★要対応項目を解消。
3. ホスティング（いずれか）: Cloudflare Pages / Netlify 等 — Root `projects/invoice-maker`、ビルド `npm run build`、出力 `dist`。GitHub Pages は有効化を人間が行い、`dist` を配置。`base: './'` のためサブディレクトリ配置可。
4. ZIP配布: `cd projects/invoice-maker && npm run build && cd dist && zip -r ../invoice-maker-dist.zip .`
5. public化・ドメイン・決済・SNS告知はすべて人間が判断。
