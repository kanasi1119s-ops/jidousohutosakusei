# 公開手順書（人間が実行）
本番反映・公開は自動では行っていません。以下は人間が判断・実行してください。

1. **事前確認**: `docs/LEGAL.md` の「要人間確認」項目（税制パラメータ照合、免責・規約）を完了。
2. **ローカル最終確認**: `npm ci && npm run check && npm test && npm run build && npm run test:e2e`
3. **公開方法（いずれか）**
   - GitHub Pages: リポジトリ Settings > Pages > Source を「GitHub Actions」に設定し、Actions の
     `Deploy furusato-limit-tracker to GitHub Pages (manual)` を手動実行。※privateリポジトリでのPages利用可否はプランに依存。
   - Cloudflare Pages 等: `dist/` を静的ファイルとしてアップロード（ビルドコマンド `npm run build`、出力 `dist`、ルートは `projects/furusato-limit-tracker`）。
   - ZIP配布: `cd dist && zip -r ../furusato-limit-tracker-dist.zip .`（ファイル名は英数字のみ）
4. **サブディレクトリ配置**: `base: './'` のため `https://example.com/sub/` 配置でも動作確認済み（簡易HTTPサーバーで検証）。
5. **公開後**: HTTPヘッダ（`X-Content-Type-Options: nosniff`、`Referrer-Policy: no-referrer`）設定、オフライン動作を実機で確認。
6. **年次更新**: 毎年、`src/params.ts` の税制値と `AS_OF` を更新し、テスト期待値を見直す。
