# 公開手順書（人間が実行。本ツールは本番反映をしていません）

1. 事前確認: `docs/LEGAL.md` の「要対応」を解消、プライバシー方針・利用規約を確定
2. リポジトリの public 化可否を判断（現状 private）
3. ビルド: `npm ci && npm run build` → `dist/`（相対パス `base: './'` のためサブディレクトリ配置でも動作）
4. 静的ホスティングのいずれかを選び、人間が有効化する
   - GitHub Pages: 本リポジトリには `.github/workflows/deploy-pages.yml`（別プロジェクト用）があるため、請求書ジェネレーター用のデプロイ設定は未作成。有効化時に `dist/` を配信する設定を追加する
   - Cloudflare Pages 等: ビルドコマンド `npm run build`、出力 `dist`、ルートディレクトリ `projects/invoice-generator`
5. 静的ファイル一式のZIP: `cd dist && zip -r ../invoice-generator-dist.zip .`（ファイル名は英数字のみ）
6. 公開後の確認: オフライン起動（一度開いた後に機内モード）、スマホ幅表示、PDF保存、日本語の表示
7. ドメイン取得・販売アカウント接続・告知は人間が判断
