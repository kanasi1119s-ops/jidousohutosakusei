# 公開手順書（人間向け・実行はしていません）

本オーケストレーターは、ドメイン取得・本番デプロイ・public化・決済設定を自動実行しません。

## 事前チェック（済み）
- [x] `npm run build` 成功、ユニット・E2E（デスクトップ/モバイル）成功
- [x] 新規cloneでREADME手順どおりに動作、`dist/` を簡易HTTPサーバーで配信して動作確認（`docs/DEBUG_LOG.md` Round 3）
- [x] ネットワーク遮断でコア機能が動作、外部リクエスト0件

## 人間が実施する手順
1. `docs/LEGAL.md` の「要人間確認」項目（一次情報・規約・特商法）を確認する
2. 必要ならリポジトリをpublic化する（現在は `kanasi1119s-ops/jidousohutosakusei` 内の `projects/invoice-maker-offline/`。単独公開は `git subtree split` で切り出し）
3. 静的ホスティングを有効化する（`vite.config.ts` は `base: './'` のためサブディレクトリでも動作）
   - GitHub Pages: 既存の `.github/workflows/deploy-pages.yml` は `income-wall-simulator` 用です。本プロジェクト用に `working-directory` と `path` を `projects/invoice-maker-offline` に変えた別ワークフローを作成し、Settings → Pages で有効化
   - Cloudflare Pages等: ビルドコマンド `npm run build`、ルート `projects/invoice-maker-offline`、出力 `dist`
4. 静的ファイル一式をZIPで配る場合: `cd dist && zip -r ../invoice-maker-offline-dist.zip .`（ファイル名は英数字のみ）
5. 有料版を用意する場合: 販売プラットフォームの設定、ライセンスキー署名用の秘密鍵の生成・保管（リポジトリに置かない）は人が実施
6. 公開後の確認: スマホ実機で印刷→PDF保存、オフライン起動（一度開いた後に機内モード）
