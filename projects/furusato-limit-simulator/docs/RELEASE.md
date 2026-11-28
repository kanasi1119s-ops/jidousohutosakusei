# 公開手順書（人間が実行）
本AIは本番反映をしていません。以下は人間が判断・実行してください。
1. `docs/LEGAL.md` の要確認項目（一次情報URL・パラメータ検証・税理士レビュー）を完了
2. `npm ci && npm run check && npm test && npm run build`
3. 静的ホスティングへ配置（`dist/` は相対パス `base: './'` のためサブディレクトリでも動作）
   - GitHub Pages: 本リポジトリの既存 `deploy-pages.yml` は income-wall-simulator 用。同一リポジトリのPagesは1サイトのため、公開するなら別リポジトリへ切り出すのを推奨。手動実行専用の `.github/workflows/furusato-limit-simulator-pages.yml` を用意済み（Pages有効化は人間）
   - Cloudflare Pages 等: ビルドコマンド `npm run build`、出力 `dist`
4. ZIP配布する場合: `cd dist && zip -r ../furusato-limit-simulator-dist.zip .`（英数字名）
5. 公開前に、公開年(2026)の末日以降は表示対象年を更新すること（2027年寄附分は193万円上限等の改正を `src/params.ts` に反映）
