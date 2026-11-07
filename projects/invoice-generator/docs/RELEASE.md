# 公開手順書（人間が実行）
1. 利用規約・プライバシー方針・免責の最終確認（`docs/LEGAL.md`）
2. リポジトリの public 化を判断（現在 private）
3. GitHub Pages を有効化: Settings → Pages → Source: GitHub Actions。その後 Actions の「Deploy invoice-generator to GitHub Pages」を手動実行（push では自動実行されない設計）
4. 別ホスティング(Cloudflare Pages等)の場合: ルート `projects/invoice-generator`、ビルド `npm run build`、出力 `dist`
5. 静的ファイルのZIP: `npm run build && cd dist && zip -r ../invoice-generator-dist.zip .`
6. 独自ドメイン・販売アカウント接続は人間が実施（本リポジトリでは未接続）
ビルドは相対パス(`base: './'`)のためサブディレクトリ配置でも動作確認済み。
