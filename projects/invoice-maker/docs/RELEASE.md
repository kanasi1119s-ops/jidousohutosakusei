# 公開手順書（人間向け・実行はしていません）

オーケストレーターはドメイン取得・本番デプロイ・public化・Pages有効化を行いません。

## 事前確認（済み）
- [x] `npm run build` 成功 / ユニット・E2Eテスト成功 / `npm audit` 0件
- [x] 静的ファイルを簡易HTTPサーバで配信して動作確認

## 手順
1. `docs/LEGAL.md` の「要対応」を確認・解消する（特に適格請求書の記載要件）
2. 静的ホスティングへ配置: `npm ci && npm run build` で生成される `dist/` を配置（相対パスなのでサブディレクトリ可）
   - GitHub Pages を使う場合は `.github/workflows/deploy-pages.yml`（income-wall-simulator用）を参考に、
     `invoice-maker` 用のワークフローを作成し、Pages設定を有効化（**人間が実施**）
3. 配布用ZIP: `cd dist && zip -r ../invoice-maker-static.zip .`
4. 公開前に実ブラウザで「オフライン再読み込み」「印刷→PDF保存」の見た目を確認
