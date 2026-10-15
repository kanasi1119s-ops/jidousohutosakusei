# 公開手順（人間が実施。本番反映は未実施）
1. 法務チェック `docs/LEGAL.md` の★項目を解消する
2. `npm ci && npm run check && npm test && npm run build`
3. 公開先を選ぶ: GitHub Pages（`.github/workflows/invoice-generator-pages.yml` を手動実行し、Settings→Pages を有効化）／Cloudflare Pages 等に `dist/` を配置（`base: './'` なのでサブディレクトリでも動作）
4. 静的ZIP: `cd dist && zip -r ../invoice-generator-dist.zip .`（ファイル名は英数字のみ）
5. 公開後、実機でオフライン動作・印刷プレビューを確認
独自ドメイン・販売アカウント接続・リポジトリpublic化は人間の判断で行う。
