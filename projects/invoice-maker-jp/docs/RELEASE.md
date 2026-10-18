# 公開手順書（人間が実行する）

このリポジトリでは本番反映（Pages有効化・public化・ドメイン・デプロイ）は一切行っていません。以下は人間向けの手順です。

## 0. 公開前チェック
- [ ] `docs/LEGAL.md` の「要人間確認」項目を完了（ポリシー・ライセンス形態・国税庁原文の再確認）
- [ ] `gitleaks detect` 等でコミット履歴を最終スキャン
- [ ] `npm ci && npm run check && npm test && npm run test:e2e` が成功すること

## 1. 静的ファイル一式のZIPを作る（どのホスティングでも使える）
```bash
cd projects/invoice-maker-jp
npm ci
npm run build
cd dist && zip -r ../invoice-maker-jp-dist.zip . && cd ..
```
`vite.config.ts` は `base: './'` なので、サブディレクトリに置いても動作します。

## 2. ホスティング先の選択肢
### A. Cloudflare Pages / Netlify（推奨: 同一リポジトリ内の複数サイトを個別にデプロイしやすい）
- ビルドコマンド: `npm ci && npm run build`
- ルートディレクトリ: `projects/invoice-maker-jp`、出力ディレクトリ: `dist`
### B. GitHub Pages
- 1リポジトリにつき1サイトのため、既存の `income-wall-simulator` 用 `.github/workflows/deploy-pages.yml` と競合します。
  どちらか一方を公開するか、サイトごとにリポジトリを分けるか、ワークフローで両方を1つの成果物にまとめて下さい。
- リポジトリの Settings → Pages で Source を「GitHub Actions」にするのは **人間が行います**。

## 3. 公開後の確認
- 公開URLを開き、ネットワークを切ってリロードしても表示されること（Service Worker）
- 請求書を1枚作り、印刷ダイアログから「PDFに保存」して日本語が正しく表示されること
- CSVをExcelで開いて文字化けしないこと

## 4. 有料版を用意する場合（未実装）
署名付きライセンスキー方式（Ed25519、公開鍵をサイトに同梱）を想定。秘密鍵の生成・保管、販売プラットフォーム
（BOOTH / Gumroad 等）の設定、特定商取引法に基づく表記は人間が行います。
