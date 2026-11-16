# 公開手順書（人間向け・実行はしていません）

本オーケストレーターは、ドメイン取得・本番デプロイ・リポジトリのpublic化・Pages有効化・課金設定を行いません。

## 事前チェック（済み）
- [x] `npm run check` / `npm test`（ユニット18件）/ `npm run test:e2e`（E2E 13件×2プロジェクト=26）成功
- [x] `npm run build` 成功、`dist/` を静的HTTPサーバーで配信して動作確認（DEBUG_LOG Round 3）
- [x] ネットワーク遮断でのコア機能動作（E2E）
- [x] `npm audit` 0件

## 人間が実施する手順
1. **リポジトリ公開の判断**: 現在 `kanasi1119s-ops/jidousohutosakusei` 内の `projects/invoice-generator/`。単独公開するなら `git subtree split` で切り出す。
2. **静的ホスティング**: ビルドコマンド `npm run build`、出力 `projects/invoice-generator/dist`、Root Directory `projects/invoice-generator`（Cloudflare Pages / Netlify 等）。GitHub Pages を使う場合は既存の `deploy-pages.yml` を参考に本プロジェクト用ワークフローを追加し、Pages を有効化（人間）。
3. **ZIP配布**: `cd projects/invoice-generator && npm run build && cd dist && zip -r ../invoice-generator-dist.zip .`
4. 公開前に `docs/LEGAL.md` の「要人間確認」を完了させる。
