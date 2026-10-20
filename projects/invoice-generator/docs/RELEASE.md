# 公開手順書（人間が実行）

本サイクルでは本番反映は一切行っていません。

## 1. 公開前チェック（人間）
- `docs/LEGAL.md` の★項目（一次情報確認、規約・プライバシー方針、特商法）
- 計算結果をサンプル数件で手計算と照合

## 2. ビルド
```bash
cd projects/invoice-generator && npm ci && npm run build   # dist/ に静的ファイル（base: './' のためサブディレクトリでも動作）
```
配布用ZIP（英数字名）: `cd dist && zip -r ../invoice-generator-dist.zip .`

## 3. ホスティング（いずれも人間が有効化）
- **Cloudflare Pages / Netlify**: ルートディレクトリ `projects/invoice-generator`、ビルドコマンド `npm run build`、出力 `dist`
- **GitHub Pages**: 本リポジトリの既存 `deploy-pages.yml` は `income-wall-simulator` 用で、Pagesは1リポジトリ1サイトのため、複数サイト運用にはプロジェクトごとの別リポジトリ化（`projects/<name>` を切り出し）を推奨
- 公開後: CSPをHTTPヘッダーでも設定、独自ドメインは人間が取得・設定

## 4. CI
`.github/workflows/invoice-generator-ci.yml`（型チェック・ユニット・ビルド・E2E）
