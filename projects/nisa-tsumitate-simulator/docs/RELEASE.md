# 公開手順（人間が実施）
1. `src/rules.ts` の数値を金融庁の最新情報で確認・更新
2. `npm ci && npm run build` → `dist/` を任意の静的ホスティングへ（相対パスのためサブディレクトリ可）
3. GitHub Pages 利用時はワークフローを作成・有効化（本サイクルでは有効化していない）
4. リポジトリ公開・ドメイン・広告は人間が判断
5. 配布ZIP: `cd dist && zip -r ../nisa-tsumitate-simulator-dist.zip .`
