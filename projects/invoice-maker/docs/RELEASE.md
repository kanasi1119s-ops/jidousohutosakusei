# 公開手順書（人間向け・実行はしていません）

本オーケストレーターはドメイン取得・本番デプロイ・public化・Pages有効化・課金設定を行いません。

## 事前チェック（済み）
- [x] `npm run build` 成功 / ユニット18件・E2E 44件（デスクトップ+モバイル）成功
- [x] クリーンclone＋READMEの手順で再現、`dist/` をサブディレクトリ配信で実ブラウザ確認
- [x] オフライン動作確認、`npm audit` 0件
- [x] GitHub Actions CI: `.github/workflows/invoice-maker-ci.yml`（型チェック・テスト・ビルド・E2E）

## 人間が実施する手順
1. `docs/LEGAL.md` の「要人間確認」を全て確認する（特に国税庁の一次情報）
2. 静的ホスティングを選ぶ（いずれも `base: './'` のためサブディレクトリ配置可）
   - **Cloudflare Pages / Netlify / Vercel**: Root Directory `projects/invoice-maker`、ビルド `npm run build`、出力 `dist`
   - **GitHub Pages**: 既存の `.github/workflows/deploy-pages.yml` は年収の壁シミュレーター用です。複数サイトを載せる場合は、`dist` をまとめる構成に人間が調整してください（Pages有効化も人間）
3. ZIP配布する場合:
   ```bash
   cd projects/invoice-maker && npm ci && npm run build
   cd dist && zip -r ../invoice-maker-dist.zip . 
   ```
   （ファイル名は英数字のみ）
4. 公開後、`docs/marketing/` の文面を確認してから投稿（誇大表現がないか最終確認）
5. 有料版を出す場合: 署名付きライセンスキー方式（Ed25519）で設計、秘密鍵はリポジトリに置かない
