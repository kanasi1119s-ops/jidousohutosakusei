# 公開手順書（人間が実施。本ファイルの作業は自動実行しません）
1. 法務確認: `docs/LEGAL.md` の「要人間確認」項目、国税庁一次情報での記載事項・端数処理の再確認
2. リポジトリのpublic化の判断（現状private）
3. GitHub Pages: リポジトリの Settings → Pages → Source を GitHub Actions に設定し、`.github/workflows/deploy-invoice-generator.yml` を実行（`workflow_dispatch`）
4. 静的ファイルZIPでの配布: `npm ci && npm run build && cd dist && zip -r ../invoicegenerator-dist.zip .`（ファイル名は英数字のみ）
5. ドメイン取得・DNS設定（必要な場合のみ）
6. 有料版を出す場合: 販売プラットフォーム接続、署名鍵の生成・保管（秘密鍵はリポジトリに置かない）、特商法表記
7. 公開後に実機（Windows Excel / iOS Safari / Android Chrome）で CSV・印刷・オフラインを確認
`vite.config.ts` は `base: './'` のためサブディレクトリ配置でも動作します。
