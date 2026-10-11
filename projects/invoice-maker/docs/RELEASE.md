# 公開手順書（人間向け・実行はしていません）

本オーケストレーターは、ドメイン取得・本番デプロイ・public化・Pages有効化・課金設定を行いません。

## 事前チェック（済み）
- [x] `npm run build` 成功 / ユニット33件・E2E 44件 成功 / `npm audit` 0件
- [x] クリーンclone＋サブディレクトリ静的配信で動作確認、オフライン動作確認済み

## 手順
1. **public化の判断**（任意）: 本プロジェクトは `kanasi1119s-ops/jidousohutosakusei` の `projects/invoice-maker/` にあります。単独公開するなら `git subtree split -P projects/invoice-maker` で切り出してください。
2. **静的ホスティング**（`base: './'` のためサブディレクトリ配置可）
   - Cloudflare Pages / Netlify / Vercel 等: Root=`projects/invoice-maker`、Build=`npm run build`、Output=`dist`
   - GitHub Pages: 既存の `.github/workflows/deploy-pages.yml` は income-wall-simulator 用です。invoice-maker 用に流用する場合は `projects/invoice-maker` へパスを変更し、Pages有効化（Settings → Pages → Source: GitHub Actions）を人間が行ってください。
   - 配信時は HTTP ヘッダーで `Content-Type: text/html; charset=utf-8` と、CSP（index.html の meta と同内容）の付与を推奨
3. **ZIP配布**: `npm run build && cd dist && zip -r ../invoice-maker-dist.zip .`（ファイル名は英数字）
4. **公開前の最終確認**: docs/LEGAL.md の★項目をすべて確認
5. **有料版を出す場合**: 署名付きライセンスキー方式（Ed25519、公開鍵のみサイトに埋め込み）で設計し、秘密鍵はリポジトリに置かず人間が生成・保管。販売プラットフォームの接続も人間が実施。
