# 公開手順書（人間が実施）
本番反映は自動では行っていません。
1. 法務・セキュリティの★項目を確認（docs/LEGAL.md）
2. （任意）プライバシー方針・利用規約をサイトに掲載（現状はREADMEとフッターのみ）
3. 静的ホスティング: `npm ci && npm run build` → `dist/` を任意の静的ホスティングへ。相対パスのためサブディレクトリでも動作
4. GitHub Pages: リポジトリ構成上、ワークフローは `.github/workflows/` に置く必要があるため、有効化時に `invoice-maker-pages.yml`（雛形は docs/pages-workflow.yml.example）を配置し、Settings → Pages で GitHub Actions を選択（public化・有効化は人間が判断）
5. ZIP配布: `cd dist && zip -r ../invoice-maker-dist.zip .`
6. 有料版・決済・ドメインを使う場合は人間がアカウント作成・接続（秘密鍵はリポジトリに置かない）
