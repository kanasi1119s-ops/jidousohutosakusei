# 公開手順書（人間向け・自動実行はしていません）

本ツールのドメイン取得・デプロイ・public化・Pages有効化は、運用指示書の安全装置により**人間が**行います。

## 事前チェック（済み）
- [x] `npm run build` 成功 / ユニット29件・E2E 26件（デスクトップ・モバイル各13）成功
- [x] `dist/` を静的HTTPサーバーで配信して開けることを確認（`docs/DEBUG_LOG.md` Round 3）
- [x] オフラインでコア機能が動作 / `npm audit` 0件

## 手順
1. `docs/LEGAL.md` の★項目（一次情報との照合・プライバシーポリシー・利用規約）を完了する。
2. リポジトリのpublic化（任意）: Settings → Change visibility。
3. 静的ホスティング（いずれか）
   - GitHub Pages: Settings → Pages で有効化し、`.github/workflows/consumption-tax-compare-pages.yml`
     を手動実行（`workflow_dispatch` のみ。自動デプロイはしない設定）。
     公開URLは `https://<user>.github.io/<repo>/` のサブパスになりますが、`base: './'` のため動作します。
   - Cloudflare Pages / Netlify 等: Root `projects/consumption-tax-compare`、Build `npm run build`、Output `dist`。
4. ZIP配布: `cd projects/consumption-tax-compare && npm run build && cd dist && zip -r ../consumption-tax-compare-dist.zip .`
5. 公開日以降、制度変更があれば `src/rules.ts` を更新（特に2026年12月31日の簡易課税届出期限前の周知が重要）。
