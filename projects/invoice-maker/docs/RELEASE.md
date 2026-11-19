# 公開手順書（人間が実行。本番反映はこのサイクルでは行っていません）
1. `npm ci && npm run check && npm test && npm run build` を実行（`dist/` が成果物。`base: './'` のためサブディレクトリ配置可）
2. 静的ZIP: `cd dist && zip -r ../invoice-maker-dist.zip .`
3. 公開先を決める（GitHub Pages / Cloudflare Pages 等）。**有効化・public化・独自ドメインは人間が判断**
4. GitHub Pages の場合: リポジトリ設定で Pages を有効化し、`dist/` を配信（既存の `deploy-pages.yml` は income-wall-simulator 用。本プロジェクト用は未作成。必要なら同ファイルを複製して `projects/invoice-maker` に向ける）
5. 公開前チェック: `docs/LEGAL.md` の ★ 項目、プライバシーポリシー・利用規約の確認
6. 公開後確認: オフライン動作（一度開く→機内モード→再読み込み）、印刷→PDF保存、CSVをExcelで開いて文字化けがないこと
