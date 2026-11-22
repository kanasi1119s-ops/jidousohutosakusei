# 請求書ジェネレーター（invoice-generator）

インボイス（適格請求書）の記載事項に対応した請求書を作成し、ブラウザの印刷機能から PDF 保存できる、
**登録不要・オフライン対応・ブラウザ完結**の Web サイトです（サイト形態: W1 静的サイト／PWA）。

- 入力データはすべてブラウザ内（localStorage）に保存され、外部へ送信されません（CSP で外部通信を禁止）
- 外部 CDN・Web フォントは使いません（日本語システムフォントのフォールバックのみ）
- 税率ごと（10% / 8%軽減）に合計してから消費税を 1 回だけ端数処理（切り捨て／四捨五入／切り上げ）
- 税抜・税込どちらの単価入力にも対応、源泉徴収税額（10.21% / 100 万円超の部分 20.42%）の差し引きに対応
- 保存済み請求書の一覧、CSV 書き出し（BOM 付き UTF-8）、JSON バックアップの書き出し／読み込み
- スマホ幅（375px）〜PC 幅で利用可能

> 本ツールは請求書作成の補助です。税務・法律上の助言ではありません。詳細は `docs/LEGAL.md`。

## ローカル起動

```bash
npm ci
npm run dev        # 開発サーバー
```

## テスト・ビルド

```bash
npm run check      # 型チェック
npm test           # ユニットテスト (Vitest)
npm run build      # 型チェック + 静的ビルド（dist/）
npm run preview    # ビルド結果の確認
npm run test:e2e   # E2E (Playwright。事前に `npx playwright install chromium` が必要な場合あり)
```

## データの保存場所

- ブラウザの localStorage（キー: `invoice-generator:data:v1`）。ブラウザのデータ消去で失われます。
- 定期的に「バックアップを書き出す(JSON)」で保存してください。

## ドキュメント

`docs/DESIGN.md` / `docs/DEBUG_LOG.md` / `docs/SECURITY.md` / `docs/LEGAL.md` / `docs/THIRD_PARTY_LICENSES.md` /
`docs/RELEASE.md` / `docs/marketing/` / `docs/REPORT.md`
