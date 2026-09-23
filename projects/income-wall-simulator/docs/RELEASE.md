# 公開手順書（人間向け・実行はしていません）

このドキュメントは、本アプリを実際に公開する際に**人間が**実施する手順です。
本オーケストレーターはドメイン取得・本番デプロイ・リポジトリのpublic化・課金設定を
自動では行いません（運用指示書 第1章 2. の安全装置に基づく）。

## 事前チェック（済み）

- [x] `npm run build` が成功する
- [x] ユニットテスト（8件）・E2Eテスト（24件、デスクトップ/モバイル）が成功する
- [x] `dist/` を静的HTTPサーバーで配信して実際に開けることを確認済み（`docs/DEBUG_LOG.md` Round 3）
- [x] オフライン（ネットワーク完全遮断）でもコア機能が動作することを確認済み
- [x] `npm audit` 0件（`docs/SECURITY.md`）

## 人間が実施する手順

### 1. リポジトリのpublic化（任意）
GitHubリポジトリの Settings → Danger Zone → Change visibility から実施してください。
※ 本プロジェクトは現在 `kanasi1119s-ops/jidousohutosakusei` リポジトリ内の
`projects/income-wall-simulator/` サブディレクトリとして管理されています
（理由は本セッションの日次レポート冒頭を参照）。単独リポジトリとして公開したい場合は、
`git subtree split` 等でこのディレクトリのみを新規リポジトリに切り出してください。

### 2. 静的ホスティングへのデプロイ
以下のいずれかを想定して `vite.config.ts` の `base: './'` を設定済みです（サブディレクトリ配置可）。

- **GitHub Pages**: リポジトリ設定でPagesを有効化し、`projects/income-wall-simulator/dist`
  の内容（`npm run build` の出力）を `gh-pages` ブランチ等に配置してください。
  同梱の GitHub Actions ワークフロー（`.github/workflows/income-wall-simulator-ci.yml`）は
  ビルド成果物をArtifactとしてアップロードするところまでを行い、Pagesへの公開は行いません。
- **Cloudflare Pages / Netlify / Vercel等**: ビルドコマンド `npm run build`、
  出力ディレクトリ `projects/income-wall-simulator/dist`、Root Directory
  `projects/income-wall-simulator` を指定してください。

### 3. ZIP配布する場合
```bash
cd projects/income-wall-simulator
npm run build
cd dist && zip -r ../income-wall-simulator-dist.zip . && cd ..
```
ZIPファイル名・内部のファイル名はすべて英数字のみで構成されており、文字化けの心配はありません。

### 4. 公開前の最終確認（人間）
- `docs/LEGAL.md` の「人間確認が必要な項目」をすべて確認・対応する
- プライバシーポリシー・利用規約の最終版を整備する
- しきい値（年収の壁の金額）の一次情報URLを確認し、必要であれば `src/thresholds.ts` を更新する

### 5. 有料版を提供する場合（将来）
- ライセンスキーはEd25519署名方式（サーバー不要）で設計すること
- 秘密鍵は絶対にリポジトリにコミットしないこと
- 特定商取引法に基づく表記を整備すること
