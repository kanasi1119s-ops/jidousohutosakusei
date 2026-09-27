# 適格請求書ジェネレーター (invoice-generator)

インボイス制度（適格請求書等保存方式）の記載要件を参考にした、登録不要・ブラウザ完結型の請求書作成ツールです。

## サイト形態

**W1: 静的サイト／ブラウザ完結Webアプリ**（サーバー不要）。ビルド後は静的ファイルのみで動作し、
GitHub Pages や Cloudflare Pages など任意の静的ホスティングにそのまま配置できます。

## 特長

- 登録不要・アカウント不要
- 事業者情報・取引先・請求書履歴をこの端末のブラウザ内（IndexedDB）にのみ保存。外部送信なし
- 税率（10%/8%/対象外）ごとに区分した消費税額の自動計算（インボイスの記載要件を参考）
- 請求書番号の自動連番管理
- 印刷（ブラウザの「PDFとして保存」機能を利用。日本語フォントの埋め込み不要で文字化けしにくい設計、詳細は`docs/DESIGN.md`）
- 履歴のCSV出力（Excelでも文字化けしないBOM付きUTF-8）、全データのJSONバックアップ/インポート
- PWA対応（Service Workerによるオフラインキャッシュ）。一度開けばネットワークが無くても請求書を作成できます

## ローカル起動手順

```bash
npm install
npm run dev
```

ブラウザで表示されるURL（例: http://localhost:5173 ）を開いてください。

## ビルド手順

```bash
npm run build
npm run preview   # ビルド済みファイルをローカルで確認する場合
```

ビルド成果物は `dist/` に出力されます（外部ランタイム依存ゼロ）。相対パス（`base: './'`）で構成
されているため、サブディレクトリ配下に配置しても動作します。

## テスト

```bash
npm run check     # 型チェック
npm test          # ユニットテスト（Vitest, 28件）
npm run test:e2e  # E2Eテスト（Playwright、ビルド＋プレビューサーバーを自動起動、36件）
```

## データの保存場所

- 事業者情報・取引先・請求書履歴: ブラウザの IndexedDB（`invoice-generator-db`）
- サーバーへの送信は一切行いません（本アプリは完全に静的ファイルのみで構成されています）

## 免責事項

本ツールは適格請求書の記載要件を参考にした簡易な作成支援であり、税務・法律上の助言に代わるもの
ではありません。詳細は `docs/LEGAL.md` およびアプリ内の免責事項を参照してください。

## ドキュメント

- 要件・画面・データモデル・PDF出力方針: [`docs/DESIGN.md`](./docs/DESIGN.md)
- デバッグ3ラウンドの記録: [`docs/DEBUG_LOG.md`](./docs/DEBUG_LOG.md)
- セキュリティチェック: [`docs/SECURITY.md`](./docs/SECURITY.md)
- 法務レビュー: [`docs/LEGAL.md`](./docs/LEGAL.md)
- サードパーティライセンス一覧: [`docs/THIRD_PARTY_LICENSES.md`](./docs/THIRD_PARTY_LICENSES.md)
- 公開手順（人間向け）: [`docs/RELEASE.md`](./docs/RELEASE.md)
- マーケ素材: [`docs/marketing/`](./docs/marketing/)
