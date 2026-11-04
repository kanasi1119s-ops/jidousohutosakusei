# インボイス対応 請求書メーカー（invoice-maker）

フリーランス・個人事業主向けの、**ブラウザだけで動く請求書作成サイト**です。登録不要・オフライン対応で、入力データはブラウザの外へ送信されません（サイト形態: W1 静的サイト）。

## 主な機能
- 税率ごと（10% / 軽減8% / 非課税）の消費税計算。適格請求書の要件に合わせ、**税率ごとに1回だけ**端数処理（切り捨て・四捨五入・切り上げ選択可）
- 適格請求書発行事業者の登録番号（T+13桁）の形式チェックと記載
- 報酬の源泉徴収税（10.21% / 100万円超の部分20.42%）の差引表示（任意）
- A4印刷用レイアウト → ブラウザの「PDFに保存」でPDF化
- 請求書の保存・読込・複製・削除、JSONバックアップ（エクスポート／インポート）
- 明細のCSV出力（Excelで文字化けしない UTF-8 BOM 付き）
- PWA（一度開けばオフラインで動作）、レスポンシブ（375px〜）
- CSPにより外部通信ゼロを技術的に担保（外部CDN・Webフォント・解析なし）

## 起動・テスト・ビルド
```bash
npm ci
npm run dev        # 開発サーバー
npm run check      # 型チェック
npm test           # ユニットテスト (Vitest)
npm run test:e2e   # E2E (Playwright。初回は npx playwright install chromium)
npm run build      # dist/ に静的ファイルを出力 (base: './' のため任意のサブディレクトリに配置可)
npm run preview    # ビルド結果を配信
```

## データの保存場所
ブラウザの `localStorage`（キー `invoice-maker:data:v1`）。ブラウザのデータ消去で失われるため、「JSONバックアップ」を定期的に保存してください。

## ドキュメント
`docs/DESIGN.md` 設計 / `docs/DEBUG_LOG.md` デバッグ記録 / `docs/SECURITY.md` / `docs/LEGAL.md` / `docs/RELEASE.md` 公開手順 / `docs/marketing/` 訴求文

## 免責
請求書作成の補助ツールであり、税務・法律上の助言ではありません。
