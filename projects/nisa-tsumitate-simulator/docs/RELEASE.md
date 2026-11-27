# 公開手順書（人間向け・未実行）

自動では行わないもの: public化、GitHub Pages有効化、独自ドメイン、決済接続、本番デプロイ。

1. `docs/LEGAL.md` の「要対応」「要人間確認」を解消（特に制度上限の一次情報確認・基準日更新）
2. 静的ホスティング（`base: './'` のためサブディレクトリ配置可）
   - Cloudflare Pages等: Root=`projects/nisa-tsumitate-simulator`、Build=`npm run build`、Output=`dist`
   - GitHub Pages: 既存の `.github/workflows/deploy-pages.yml` は income-wall-simulator 用。複数サイトを載せる場合は人間がワークフローを調整してから有効化
3. ZIP配布: `npm run build && cd dist && zip -r ../nisa-tsumitate-simulator-dist.zip .`
4. 有料版（将来）: Ed25519署名ライセンスキー方式（秘密鍵はリポジトリに置かない）、特商法表記
