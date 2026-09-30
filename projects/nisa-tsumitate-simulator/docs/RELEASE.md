# 公開手順書（人間が実施）
1. リポジトリのpublic化を判断（現在private）。
2. 静的ホスティング: GitHub Pages を有効化（Settings → Pages → GitHub Actions）し `.github/workflows/deploy-nisa-tsumitate-simulator.yml` を実行。または `npm run build` の `dist/` を任意の静的ホスティングへ。
3. `npm run build` 後、`dist/` を英数字名のZIPにすればそのまま配布可能（相対パス `base: './'`）。
4. プライバシーポリシー・利用規約・免責の最終確認、有料版を出す場合は特商法表記・決済アカウント・ライセンス鍵の秘密鍵管理。
5. 独自ドメインを使う場合はドメイン取得・DNS設定。
