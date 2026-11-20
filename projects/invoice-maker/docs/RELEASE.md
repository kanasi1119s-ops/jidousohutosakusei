# 公開手順書（人間向け・実行はしていません）
本オーケストレーターはドメイン取得・本番デプロイ・public化・Pages有効化・課金設定を行いません。

## 事前チェック（済み）
- [x] `npm run check` / `npm test` / `npm run build` / `npm run test:e2e` 成功
- [x] `dist/` を静的HTTPサーバーで配信して動作確認（`docs/DEBUG_LOG.md` Round 3）
- [x] オフライン動作確認、`npm audit` 0件

## 人間が実施
1. 内容確認: `docs/LEGAL.md` の★項目（国税庁の公式資料との照合）
2. 公開先を選ぶ（GitHub Pages / Cloudflare Pages / Netlify 等）。`base: './'` のためサブディレクトリ配置可。ビルド: `npm run build`、出力: `projects/invoice-maker/dist`
   - GitHub Pagesを使う場合: Settings → Pages を有効化し、必要なら既存の `deploy-pages.yml` を複数プロジェクト対応に修正（現状は income-wall-simulator 用）
3. ZIP配布: `cd projects/invoice-maker && npm run build && cd dist && zip -r ../invoice-maker-dist.zip .`
4. 独自ドメイン・public化・告知は人間が判断
