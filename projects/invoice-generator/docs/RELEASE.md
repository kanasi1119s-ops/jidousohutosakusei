# 公開手順書（人間向け）

AIは本番公開を行っていません。以下は人間が判断・実行します。

## 0. 公開前チェック
- [ ] `docs/LEGAL.md` の「人間の確認が必要な項目」を完了
- [ ] 税理士等に計算仕様を確認（任意だが推奨）
- [ ] リポジトリをpublic化するか判断（このリポジトリは現在private）

## 1. 静的ファイル一式の作成
```bash
cd projects/invoice-generator
npm ci && npm run build
cd dist && zip -r ../invoicegenerator.zip .   # 英数字のファイル名
```
`dist/` は相対パス（`base: './'`）なので、サブディレクトリ配置でも動作します。

## 2. ホスティング（いずれか）
- **GitHub Pages**: 既存の `.github/workflows/deploy-pages.yml` は income-wall-simulator 用です。本プロジェクト用に使う場合は `projects/invoice-generator` へパスを変更し、Settings → Pages で GitHub Actions を有効化（有効化は人間）
- **Cloudflare Pages / Netlify**: ビルドコマンド `npm run build`、出力 `dist`、ルート `projects/invoice-generator`

## 3. 公開後の確認
- [ ] ページが開く／日本語が正しく表示される
- [ ] ネットワークを切っても動く（初回表示後にオフラインで再読み込み）
- [ ] 印刷（PDF保存）で請求書のみが出力される

## 4. 有料版を検討する場合（未実装）
販売アカウント接続・ライセンスキー署名用の秘密鍵の生成と保管・特商法表記は人間が行います。秘密鍵はリポジトリに置かないでください。
