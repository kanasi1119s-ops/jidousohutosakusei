# 公開手順書（人間向け・未実行）
本オーケストレーターは公開・デプロイ・課金・ドメイン取得を実行しません。

1. 事前確認（済）: `npm run check` / `npm test` / `npm run test:e2e` / `npm run build` / `npm audit` 0件
2. **税制数値の一次情報確認**（`docs/LEGAL.md` ★1）
3. 静的ホスティング（いずれも人間が有効化）
   - GitHub Pages: 既存 `.github/workflows/deploy-pages.yml` は income-wall-simulator 用。本サイト用に `projects/furusato-limit-simulator/dist` を配信するよう調整してから有効化
   - Cloudflare Pages / Netlify 等: Root `projects/furusato-limit-simulator`、Build `npm run build`、Output `dist`
4. ZIP配布: `npm run build && cd dist && zip -r ../furusato-limit-simulator-dist.zip .`（ファイル名は英数字のみ）
5. 公開前: プライバシーポリシー/利用規約の確認、OGP・独自ドメイン（任意）
6. **時期の注意**: 寄附の年内期限は 2026-12-31。公開が遅れると今年の需要を逃すため、公開判断はお早めに。年明け以降は基準年（令和9年分）への更新が必要
