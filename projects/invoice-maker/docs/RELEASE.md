# 公開手順書（人間向け・実行はしていません）

本オーケストレーターはドメイン取得・本番デプロイ・public化・課金設定を行いません。

## 事前チェック（済み）
- [x] `npm run build` 成功 / ユニット26件・E2E 32件（16件×デスクトップ/モバイル）成功
- [x] `dist/` を静的サーバーで配信し、サブディレクトリ配置（`base: './'`）でも動作することを確認
- [x] ネットワーク遮断状態で請求書作成・保存が動作
- [x] `npm audit` 0件

## 人間が行うこと
1. リポジトリ public 化の判断（現在は `kanasi1119s-ops/jidousohutosakusei` 内の `projects/invoice-maker/`）
2. 静的ホスティング: Cloudflare Pages / Netlify 等は Root=`projects/invoice-maker`、Build=`npm run build`、出力=`dist`。GitHub Pagesを使う場合は、既存の `.github/workflows/deploy-pages.yml`（income-wall-simulator用）はこのプロジェクトをデプロイしないため、複数サイト対応への変更が必要
3. ZIP配布: `npm run build && cd dist && zip -r ../invoice-maker-dist.zip .`
4. `docs/LEGAL.md` の★項目（一次情報の確認、プライバシーポリシー/利用規約、特商法）
5. 実在の請求書として使い始める前に、出力内容を税理士等で確認
