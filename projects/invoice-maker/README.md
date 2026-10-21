# 請求書・見積書メーカー（invoice-maker）

登録不要・オフライン対応で、インボイス制度の記載事項（登録番号・税率ごとの消費税額）に沿った請求書／見積書を作成し、印刷／PDF保存できるブラウザ完結のWebサイトです。

- **サイト形態**: W1（静的サイト／ブラウザ完結・PWA）。サーバー不要
- **データの保存場所**: 閲覧中ブラウザの localStorage のみ。外部送信なし（CSPで `connect-src 'self'`）
- **バックアップ**: JSONエクスポート／インポート、明細のCSV（BOM付きUTF-8）

## 起動手順

```bash
npm ci
npm run dev        # 開発サーバー
```

## テスト・ビルド

```bash
npm run check      # 型チェック
npm test           # ユニットテスト(Vitest)
npm run build      # 静的ビルド (dist/)
npm run test:e2e   # E2E(Playwright。事前に npx playwright install chromium が必要な環境あり)
npm run preview    # ビルド成果物の確認
```

## 注意

本ツールは書類作成の補助であり、税務・法律上の適否を保証しません。登録番号は形式（T+13桁）のみ検査します。実在確認は国税庁の適格請求書発行事業者公表サイトで行ってください。
公開手順は `docs/RELEASE.md`、設計は `docs/DESIGN.md` を参照してください。
