# 公開手順書（人間向け）

**本セッションでは、公開・デプロイ・ドメイン取得・決済接続は一切行っていません。**

## 事前確認
1. `docs/LEGAL.md` の「要確認」項目（国税庁の一次情報の確認・出典と基準日の追記、プライバシーポリシー／利用規約の確定）
2. `LICENSE` の形態を決定（OSS化 or 独自利用規約）
3. 秘密情報スキャン（`gitleaks detect`）の実行

## 静的ファイルの作成
```bash
cd projects/invoice-maker
npm ci && npm run build   # dist/ が生成される（base: './' のためサブディレクトリ配置でも動作）
cd dist && zip -r ../invoice-maker-dist.zip .
```
`dist/` の中身をそのまま任意の静的ホスティングへアップロードすれば動作します（サブディレクトリ配置は検証済み）。

## GitHub Pages で公開する場合
1. リポジトリ設定 → Pages → Source を「GitHub Actions」に変更（**人間が実施**。private リポジトリでの Pages 利用はプランによる）
2. Actions → "Deploy invoice-maker to GitHub Pages (manual)" を手動実行
3. 公開URLで、日本語表示・計算・保存・CSV・オフライン再読み込みを確認

## 公開後チェック
- ブラウザの開発者ツールでコンソールエラー・外部通信が0であること
- スマホ実機で表示・印刷（PDF保存）を確認
