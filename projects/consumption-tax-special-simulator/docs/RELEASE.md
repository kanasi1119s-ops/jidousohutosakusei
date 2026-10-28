# 公開手順書（人間向け・未実行）
本オーケストレーターはドメイン取得・デプロイ・public化を行いません。

## 事前チェック（済）
ビルド成功 / ユニット12件・E2E 24件成功 / オフライン動作確認 / `npm audit` 0件。

## 公開前に必ず実施
1. `docs/LEGAL.md` の「★制度要件の一次情報確認」を完了し、必要なら `src/rules.ts` を修正
2. プライバシーポリシー・利用規約の確定、ライセンス形態の決定

## 公開（いずれか）
- **Cloudflare Pages / Netlify**: Root `projects/consumption-tax-special-simulator`、ビルド `npm run build`、出力 `dist`
- **GitHub Pages**: 既存の `.github/workflows/deploy-pages.yml` は income-wall-simulator 専用。複数サイトを1リポジトリのPagesに載せる場合は、サイトごとにサブパスへ配置するようワークフローを人間が調整するか、サイトごとに別リポジトリへ切り出すこと
- **ZIP**: `npm run build && cd dist && zip -r ../consumption-tax-special-simulator-dist.zip .`
