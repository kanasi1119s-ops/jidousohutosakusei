# インボイス請求書ジェネレーター（invoice-generator）

適格請求書（インボイス）の記載事項に沿った請求書を、**登録不要・オフライン・ブラウザ完結**で作成し、PDF保存できる静的Webサイトです（サイト形態: W1）。

- 入力データはブラウザの localStorage にのみ保存。外部送信なし（CSPで `connect-src 'self'` に制限）
- 税率ごと（10% / 8%軽減）に合計して消費税を1回だけ端数処理（切り捨て/四捨五入/切り上げ選択）
- 税抜・税込、源泉徴収（10.21% / 100万円超は20.42%）対応
- 登録番号（T+13桁）の形式チェック。明細CSV（BOM付きUTF-8）・JSONのエクスポート/インポート
- PDF保存はブラウザの「印刷 → PDFとして保存」を利用（A4用印刷CSS）
- PWA対応（一度開けばオフラインで動作）

## 開発

```bash
npm install
npm run dev        # 開発サーバー
npm run check      # 型チェック
npm test           # ユニットテスト（Vitest）
npm run test:e2e   # E2E（Playwright。初回は npx playwright install chromium）
npm run build      # dist/ に静的ファイルを出力（相対パスのためサブディレクトリ配置可）
```

## データの保存場所
ブラウザの localStorage（キー `invoice-generator:draft`）。端末・ブラウザを変える場合は「データを保存(JSON)」で書き出してください。

詳細: `docs/DESIGN.md` / `docs/RELEASE.md` / `docs/LEGAL.md` / `docs/SECURITY.md` / `docs/DEBUG_LOG.md`
