# 公開手順書（人間が実施）

1. docs/LEGAL.md の「人間の確認が必要な事項」を完了（特に `src/rules.ts` の一次情報照合）
2. `npm ci && npm run check && npm test && npm run test:e2e && npm run build`
3. 静的ホスティングへ `dist/` を配置（相対パスなのでサブディレクトリ可）
   - GitHub Pages: リポジトリのPages設定で有効化（ワークフロー追加は人間が判断。現状は有効化していません）
   - Cloudflare Pages 等: ビルドコマンド `npm run build`、出力 `dist`、ルート `projects/furusato-limit-simulator`
4. ZIP配布する場合: `cd dist && zip -r ../furusato-limit-simulator-dist.zip .`
5. 公開後、オフライン動作（一度開いて機内モードで再読み込み）を確認
