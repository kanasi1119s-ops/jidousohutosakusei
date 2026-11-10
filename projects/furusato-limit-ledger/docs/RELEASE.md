# 公開手順書（人間が実行）
本番反映は未実施です。以下は人間が判断・実行してください。
1. 内容確認（`docs/LEGAL.md` の要確認項目、一次情報URLの確認）
2. 公開方法を選ぶ
   - GitHub Pages: リポジトリを public 化（または有料プラン）→ Settings > Pages で Source を GitHub Actions に設定 → `.github/workflows/furusato-limit-ledger-pages.yml` を実行
   - Cloudflare Pages 等: ビルドコマンド `npm run build`、出力 `dist`、ルート `projects/furusato-limit-ledger`
   - ZIP配布: `npm run build` 後に `dist/` を `furusato-limit-ledger-dist.zip` に圧縮
3. サブディレクトリ配置でも動作確認済み（`base: './'`）
4. 独自ドメイン・告知（SNS）は `docs/marketing/` を参照して人間が実施
