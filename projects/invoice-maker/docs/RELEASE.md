# 公開手順書（人間が実施）
本番反映・公開は自動では行っていません。
1. 公開可否を判断（LEGAL.mdの★項目を確認）。
2. 静的ホスティングを選ぶ:
   - GitHub Pages: リポジトリをpublic化(またはPages対応プラン)し、Settings→Pagesを有効化。`.github/workflows/deploy-pages-invoice-maker.yml` を手動実行(workflow_dispatch)。
   - Cloudflare Pages等: ビルドコマンド `npm run build`、出力 `dist`、ルート `projects/invoice-maker`。
3. 手動配置: `npm ci && npm run build` 後、`dist/` の中身をそのままアップロード（ZIP化する場合のファイル名は英数字: `invoice-maker-dist.zip`）。
4. 公開後の確認: トップ表示、日本語表示、オフライン再読込、CSV出力(BOM)。
5. 必要に応じて独自ドメイン/DNS設定（人間が実施）。
