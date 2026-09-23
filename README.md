# ふるさと納税 控除上限額シミュレーター

年収と家族構成から、ふるさと納税の控除上限額（概算）をその場で計算するWebサイトです。

## サイト形態

**W1（静的サイト・ブラウザ完結Webアプリ / PWA）**。サーバーは不要で、静的ファイル
一式（`dist/`）をどのような静的ホスティングにも配置できます。

- 入力データ（年収・家族構成・計算結果）は**ブラウザのlocalStorageにのみ保存**され、
  外部には一切送信されません。
- 一度開けば、Service WorkerによりオフラインでもコアのUI・計算機能が動作します。
- JSON（バックアップ用・往復可能）およびCSV（BOM付きUTF-8、Excelでも文字化けしない）
  でのエクスポート・インポートに対応しています。

## ローカル起動手順

```bash
npm install
npm run dev       # http://localhost:5173 で開発サーバーが起動
```

## ビルド手順

```bash
npm run build      # 型チェック + dist/ への静的ビルド
npm run preview    # ビルド結果をローカルで確認 (http://localhost:4173)
```

`dist/` 以下の静的ファイルをそのままどの静的ホスティングにもアップロードできます
（`base: './'` 設定のため、サブディレクトリ配置でも動作します）。

## テスト

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # ESLint
npm run test        # Vitest（ユニットテスト）
npm run test:e2e    # Playwright（E2E、日本語表示・CSV文字コード・オフライン動作を含む）
npm run check       # lint + typecheck + test をまとめて実行
```

## データの保存場所

- 入力・計算結果は **ブラウザのlocalStorage**（キー: `furusato-sim.v1`）にのみ保存されます。
- サーバーやどこかの外部サービスに送信されることはありません（`index.html`のCSPで
  外部通信を技術的にも制限しています）。
- 「JSONでエクスポート」でバックアップを取得し、「JSONをインポート」で復元できます。

## 計算方法・免責事項

本ツールが示す金額は、一般的な給与所得者を想定した簡易モデルによる概算です。
医療費控除・iDeCo・住宅ローン控除など個別の事情により実際の金額は変動します。
正確な金額は自治体・税務署・税理士等にご確認ください。計算式の根拠は
[総務省 ふるさと納税のしくみ｜税金の控除について](https://www.soumu.go.jp/main_sosiki/jichi_zeisei/czaisei/czaisei_seido/furusato/mechanism/deduction.html)
を参照しています（詳細は `src/lib/calc.ts` のコメント、および `docs/DESIGN.md` 参照）。

## ドキュメント

- 要件・データモデル: [`docs/DESIGN.md`](./docs/DESIGN.md)
- デバッグ3ラウンドの記録: [`docs/DEBUG_LOG.md`](./docs/DEBUG_LOG.md)
- セキュリティ・ライセンス確認: [`docs/THIRD_PARTY_LICENSES.md`](./docs/THIRD_PARTY_LICENSES.md)
- 法務レビュー: [`docs/LEGAL_REVIEW.md`](./docs/LEGAL_REVIEW.md)
- 公開手順（人間向け）: [`docs/RELEASE.md`](./docs/RELEASE.md)
- 日次レポート: [`docs/REPORT.md`](./docs/REPORT.md)
