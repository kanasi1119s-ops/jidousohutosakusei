# インボイス対応 請求書ジェネレーター (invoice-generator)

登録不要・オフライン対応・入力データがブラウザ外へ出ない、請求書作成Webサイト（サイト形態: W1 静的／ブラウザ完結）。

## 機能
- 適格請求書の記載事項（登録番号 T+13桁、発行日、税率ごとの対価・消費税額 等）の入力と不足チェック
- 10%/8%の税率区分、税率ごとに1回の端数処理（切り捨て/四捨五入/切り上げ）
- ブラウザの印刷機能による PDF 保存、CSV 出力（BOM付きUTF-8）
- 保存（localStorage）、JSONバックアップのエクスポート/インポート
- PWA（オフライン動作）、レスポンシブ（375px〜）、CSPで外部通信ゼロ

## 開発
```
npm ci
npm run dev        # 開発サーバー
npm run check      # 型チェック
npm test           # ユニットテスト(Vitest)
npm run test:e2e   # E2E(Playwright。ビルド→preview起動を自動実行)
npm run build      # dist/ に静的ファイル一式を出力
```
データの保存場所: ブラウザの localStorage（キー `invoice-generator:v1`）。サーバー送信なし。
公開手順は `docs/RELEASE.md`、設計は `docs/DESIGN.md` を参照。
