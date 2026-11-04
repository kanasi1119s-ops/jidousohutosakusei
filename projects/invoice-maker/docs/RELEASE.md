# 公開手順書（人間が実行）
本番反映は自動化していません。以下を判断・実施してください。
1. `docs/LEGAL.md` の「人間の確認が必要」を完了する
2. 公開方法を選ぶ
   - GitHub Pages: リポジトリを public 化 or 有料プランの private Pages → Settings > Pages で Source を GitHub Actions に設定 → Actions の「Deploy invoice-maker to GitHub Pages (manual)」を手動実行
   - 他の静的ホスティング: `npm ci && npm run build` の `dist/` を配置（`base: './'` のためサブディレクトリ可）
   - ZIP配布: `cd dist && zip -r ../invoice-maker-dist.zip .`
3. 公開後、(a) 日本語表示 (b) 機内モードで再読込して動作 (c) 印刷プレビューA4 を確認
4. 独自ドメイン・販売アカウント・広告は人間が判断
