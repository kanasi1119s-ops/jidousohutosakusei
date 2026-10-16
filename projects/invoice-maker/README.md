# 請求書メーカー (invoice-maker)

インボイス（適格請求書）の記載事項に対応した請求書を作成し、PDFとして保存できる、**登録不要・オフライン対応のブラウザ完結Webサイト（W1）**です。

- 入力データはブラウザ内（localStorage）にのみ保存され、外部へ送信されません（CSPで外部通信を禁止）
- 消費税は「1枚の請求書につき、税率ごとに1回」端数処理（切り捨て/四捨五入/切り上げ選択可）
- 税抜/税込入力、10%・8%（軽減）・非課税、値引き行、源泉徴収税額（10.21%／100万円超部分20.42%）
- PDF保存はブラウザの印刷機能（「PDFに保存」）を使用。ファイル名は請求書番号（英数字）
- 保存済み一覧のCSV（BOM付きUTF-8）、バックアップ/復元（JSON）

## 開発

```
npm ci
npm run dev        # 開発サーバー
npm run check      # 型チェック
npm test           # ユニットテスト (Vitest)
npm run test:e2e   # E2E (Playwright)。初回は npx playwright install chromium
npm run build      # dist/ に静的ファイルを出力（相対パス。サブディレクトリ配置可）
npm run preview    # ビルド結果の確認
```

## データの保存場所
ブラウザの localStorage（キー `invoice-maker:*`）。ブラウザのデータ消去で失われるため、画面の「バックアップ(JSON)」を定期的に保存してください。

## 注意
税務・法律上の助言ではありません。公開手順は `docs/RELEASE.md`、設計は `docs/DESIGN.md`、法務は `docs/LEGAL.md` を参照。
