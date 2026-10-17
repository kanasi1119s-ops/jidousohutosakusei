# 公開手順書（人間向け・未実行）

本オーケストレーターは、Pages有効化・public化・ドメイン・課金設定を行いません。

## 事前チェック（済み）
- [x] `npm run check` / `npm test` / `npm run test:e2e` / `npm run build`
- [x] `dist/` を静的HTTPサーバーで配信して開けること、オフライン動作

## 人間が行うこと
1. 計算ロジックの一次情報照合（`docs/LEGAL.md`）
2. 公開先の決定: GitHub Pages / Cloudflare Pages 等。
   - Cloudflare Pages等: Root Directory `projects/furusato-limit-simulator`、ビルド `npm run build`、出力 `dist`
   - GitHub Pages: 既存の `.github/workflows/deploy-pages.yml` は income-wall-simulator 専用。複数サイトを載せる場合はワークフロー改修が必要
3. リポジトリ public 化の判断
4. 公開時期: 寄附の関心は11〜12月に高まるため、公開するなら早めが望ましい

## ZIP作成
```bash
npm run build && cd dist && zip -r ../furusato-limit-dist.zip .
```
