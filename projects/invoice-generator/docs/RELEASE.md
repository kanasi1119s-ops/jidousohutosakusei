# 公開手順（人間向け・本番反映は未実施）

1. リポジトリの公開範囲（private のまま／public 化）を判断する。
2. ビルド: `npm ci && npm run build` → `dist/` が静的ファイル一式（`base: './'` のためサブディレクトリでも動作）。
3. ホスティング（いずれも**人間が実施**）:
   - GitHub Pages: 現在 `.github/workflows/deploy-pages.yml` は income-wall-simulator 用。同一リポジトリでは Pages は1サイトのため、
     本サイトを公開するには別リポジトリへ分離するか、ワークフローを統合する必要がある。
   - Cloudflare Pages 等: ビルドコマンド `npm run build`、出力 `dist`、ルートディレクトリ `projects/invoice-generator`。
4. ZIP 配布する場合: `cd dist && zip -r ../invoice-generator-dist.zip .`（ファイル名は英数字のみ）。
5. 公開前チェック: `docs/LEGAL.md` の「要人間確認」項目、オフライン動作（ブラウザで一度開いて機内モードで再読込）。
