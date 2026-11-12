# 公開手順書（人間向け・実行はしていません）

本オーケストレーターは、ドメイン取得・本番デプロイ・public化・Pages有効化・課金設定を自動では行いません。

## 事前チェック（済み）
- [x] `npm run check` / `npm test`（ユニット16件）/ `npm run build`
- [x] E2E（Playwright、デスクトップ/モバイル）
- [x] ビルド成果物を静的HTTPサーバーのサブディレクトリ配信で実際に開けることを確認（相対パス `base: './'`）
- [x] オフライン再読み込みで動作
- [x] `npm audit` 0件

## 人間が実施する手順
1. 公開判断（リポジトリpublic化は任意。単独公開したい場合は `git subtree split --prefix=projects/invoice-generator` で切り出し）
2. 静的ホスティング（いずれか）
   - GitHub Pages: 本プロジェクト用のデプロイワークフロー雛形は `docs/deploy-pages.yml.example`。
     `.github/workflows/` に置いて有効化（既存の income-wall-simulator 用ワークフローと同一Pagesを奪い合うため、別リポジトリ化を推奨）
   - Cloudflare Pages / Netlify 等: Root `projects/invoice-generator`、ビルド `npm run build`、出力 `dist`
3. ZIP配布: `npm run build && cd dist && zip -r ../invoice-generator-dist.zip .`
4. 公開前に `docs/LEGAL.md` の★項目（一次情報の確認・プライバシー方針・利用規約）を確認
5. 有料版を提供する場合: 販売プラットフォーム接続、署名鍵の生成・保管（秘密鍵はリポジトリに置かない）、特商法表記
