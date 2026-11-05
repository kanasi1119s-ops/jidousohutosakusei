# 公開手順書（人間向け・未実行）
1. 事前確認済み: build / unit 11 / E2E 20 / npm audit 0
2. public化・GitHub Pages有効化・独自ドメインは**人間が判断**（`base: './'` のためサブディレクトリ配置可）
3. 静的ホスティング: ビルドコマンド `npm run build`、出力 `dist`、Root Directory `projects/nisa-tsumitate-simulator`
4. ZIP: `cd dist && zip -r ../nisa-tsumitate-simulator-dist.zip .`
5. 公開前に `docs/LEGAL.md` の要人間確認項目を完了すること
