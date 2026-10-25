# 請求書メーカー (invoice-maker)

適格請求書の記載事項（発行者名・登録番号・税率ごとの対象額と消費税額）に対応した請求書を作成し、
印刷／PDFで保存できる **ブラウザ完結のWebサイト**（サイト形態 W1）です。

- 登録不要・サーバー不要。入力データはブラウザ内（localStorage）にだけ保存され、外部送信しません
- オフラインでも動作（PWA / Service Worker）
- 外部CDN・Webフォント不使用。CSPで外部通信を遮断
- 本番依存パッケージはゼロ（開発ツールのみ）

## 使い方（ローカル）

```bash
npm ci
npm run dev        # 開発サーバー
npm run check      # 型チェック
npm test           # ユニットテスト
npm run build      # 型チェック + 静的ビルド（dist/）
npm run test:e2e   # Playwright E2E（初回は npx playwright install chromium）
```

`dist/` は相対パス（`base: './'`）でビルドされるため、サブディレクトリに置いても動作します。

## データの保存場所
- ブラウザの localStorage（キー `invoice-maker:v1`）。ブラウザのデータ消去で失われるため、
  画面の「バックアップを書き出す（JSON）」で定期的に保存してください。

## 免責
本ツールは請求書作成の補助です。税務・法律上の助言ではありません。詳細は `docs/LEGAL.md`。
