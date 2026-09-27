# 公開手順書（人間向け・実行はしていません）

このドキュメントは、本アプリを実際に公開する際に**人間が**実施する手順です。
本オーケストレーターはドメイン取得・本番デプロイ・リポジトリのpublic化・課金設定を
自動では行いません（運用指示書 第1章 2. の安全装置に基づく）。

## 事前チェック（済み）

- [x] `npm run build` が成功する（バンドルサイズ: JS 23.58KB / CSS 2.47KB、外部ランタイム依存ゼロ）
- [x] ユニットテスト（28件）・E2Eテスト（36件、デスクトップ/モバイル）が成功する
- [x] `dist/` を静的HTTPサーバーで配信して実際に開けることを確認済み（`docs/DEBUG_LOG.md` Round 3）
- [x] オフライン（ネットワーク完全遮断）でも請求書の作成・保存が動作することを確認済み
- [x] `npm audit` 0件（`docs/SECURITY.md`）

## ⚠ 重要: GitHub Pagesは1リポジトリに1サイトのみ

本リポジトリには `income-wall-simulator` と `invoice-generator` の2プロジェクトが存在しますが、
**GitHub Pagesは1リポジトリにつき1つの公開サイトしか持てません。** 同梱した
`.github/workflows/deploy-pages-invoice-generator.yml` と既存の `deploy-pages.yml` を両方有効化すると、
どちらのプロジェクトが最後にデプロイされたかによって公開内容が上書きされてしまいます。
複数プロジェクトを両方公開したい場合は、以下のいずれかを人間が選択してください。

1. 各プロジェクトを別リポジトリに切り出す（`git subtree split`等）
2. 1つのGitHub Pagesサイトの中に `/income-wall-simulator/` `/invoice-generator/` のようなサブパスを
   作り、両方の`dist`を1つのデプロイにまとめるビルドスクリプトを新たに用意する
3. Cloudflare Pages / Netlify 等、プロジェクトごとに複数サイトを持てるホスティングを使う（③を推奨）

## 人間が実施する手順

### 1. リポジトリのpublic化（任意）
GitHubリポジトリの Settings → Danger Zone → Change visibility から実施してください。
※ 本プロジェクトは現在 `kanasi1119s-ops/jidousohutosakusei` リポジトリ内の
`projects/invoice-generator/` サブディレクトリとして管理されています
（理由は本セッションの日次レポート冒頭を参照）。単独リポジトリとして公開したい場合は、
`git subtree split` 等でこのディレクトリのみを新規リポジトリに切り出してください。

### 2. 静的ホスティングへのデプロイ
`vite.config.ts` の `base: './'` により、サブディレクトリ配置でも動作するよう構成済みです。

- **GitHub Pages**: 上記の注意事項を確認のうえ、リポジトリ設定でPagesを有効化してください。
  同梱の GitHub Actions ワークフロー（`.github/workflows/invoice-generator-ci.yml`）はビルド成果物を
  Artifactとしてアップロードするところまでを行い、Pagesへの公開は行いません。
- **Cloudflare Pages / Netlify / Vercel等**: ビルドコマンド `npm run build`、
  出力ディレクトリ `projects/invoice-generator/dist`、Root Directory
  `projects/invoice-generator` を指定してください。

### 3. ZIP配布する場合
```bash
cd projects/invoice-generator
npm run build
cd dist && zip -r ../invoice-generator-dist.zip . && cd ..
```
ZIPファイル名・内部のファイル名はすべて英数字のみで構成されており、文字化けの心配はありません。

### 4. 公開前の最終確認（人間）
- `docs/LEGAL.md` の「人間確認が必要な項目」をすべて確認・対応する
- 利用規約・免責事項の最終版を整備する
- 消費税額の端数処理・インボイス記載要件について国税庁の一次情報URLを確認し、必要であれば
  `docs/LEGAL.md` に追記する

### 5. 有料版を提供する場合（将来）
- ライセンスキーはEd25519署名方式（サーバー不要）で設計すること
- 秘密鍵は絶対にリポジトリにコミットしないこと
- 特定商取引法に基づく表記を整備すること
