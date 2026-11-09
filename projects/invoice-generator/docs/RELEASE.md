# 公開手順書（人間向け・未実行）
本オーケストレーターはデプロイ・public化・ドメイン取得を行いません。以下は人間が実施します。

事前チェック済み: build成功 / ユニット28件・E2E32件成功 / dist をHTTP配信で確認 / オフライン動作確認 / npm audit 0件。

1. リポジトリ公開範囲の判断（現状private。本プロジェクトは `projects/invoice-generator/` 配下）
2. 静的ホスティング: `npm ci && npm run build` → `dist/` を配置（`base: './'` のためサブディレクトリ可）。
   GitHub Pages / Cloudflare Pages / Netlify いずれも可（有効化は人間）。Root Directory は `projects/invoice-generator`
3. ZIP配布: `cd dist && zip -r ../invoice-generator-dist.zip .`
4. 公開前に `docs/LEGAL.md` の★項目を確認
