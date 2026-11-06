# 公開手順書（人間が実行）
1. 法務・セキュリティ記録（`docs/LEGAL.md` / `docs/SECURITY.md`）の「要人間確認」を解消する。
2. リポジトリの public 化を判断する。
3. GitHub Pages を有効化する（Settings → Pages → Source: GitHub Actions）。`.github/workflows/deploy-invoice-maker.yml` を手動実行（workflow_dispatch）。
4. 静的ファイルZIPが必要なら: `npm ci && npm run build && cd dist && zip -r ../invoice-maker-dist.zip .`
5. 独自ドメイン・有料版・決済連携は人間の判断で別途実施（本リポジトリでは未実装）。
