# 公開手順書（人間が実施）
1. リポジトリのpublic化を判断（現在private）。
2. `npm ci && npm run build` → `dist/` が静的ファイル一式（相対パスなのでサブディレクトリ配置可）。
3. ホスティング（GitHub Pages / Cloudflare Pages 等）を選び有効化。GitHub Pagesは1リポジトリ1サイトのため、複数プロジェクトの公開方法（別リポジトリ切り出し等）を決める。
4. ZIP配布: `cd dist && zip -r ../withholding-tax-calculator-dist.zip .`
5. 公開前に docs/LEGAL.md の要人間確認項目を解消。
本ワークフローでは本番デプロイ・ドメイン取得・決済接続は行っていません。
