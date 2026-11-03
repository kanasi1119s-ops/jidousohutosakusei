# 公開手順（人間が実行）
1. `npm ci && npm run check && npm test && npm run build`
2. `dist/` が公開物（`base: './'` のため任意のサブディレクトリで動作）
3. 静的ホスティング（GitHub Pages / Cloudflare Pages 等）へ `dist/` を配置。GitHub Pages を使う場合はワークフローの追加と有効化、リポジトリの公開範囲の判断が必要
4. ZIP化する場合は英数字のファイル名（例: `invoice-maker-dist.zip`）
5. 公開前に docs/LEGAL.md の「要人間確認」項目を完了すること
