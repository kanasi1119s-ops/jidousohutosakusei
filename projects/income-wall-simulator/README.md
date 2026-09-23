# 年収の壁シミュレーター (income-wall-simulator)

時給・週の労働時間から、税金・社会保険の「年収の壁」までの余裕を試算するブラウザ完結型の Web アプリです。

## サイト形態

**W1: 静的サイト／ブラウザ完結Webアプリ**（サーバー不要）。ビルド後は静的ファイルのみで動作し、
GitHub Pages や Cloudflare Pages など任意の静的ホスティングにそのまま配置できます。

## 特長

- 登録不要・アカウント不要
- 入力データは一切外部送信されず、この端末のブラウザ内（`localStorage`）にのみ保存されます
- PWA対応（Service Workerによるオフラインキャッシュ）。一度開けばネットワークが無くても利用できます
- 設定のJSON エクスポート/インポート、試算結果のCSVダウンロード（Excelでも文字化けしないBOM付きUTF-8）

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

ビルド成果物は `dist/` に出力されます。相対パス（`base: './'`）で構成されているため、
サブディレクトリ配下（例: `https://example.com/tools/income-wall-simulator/`）に配置しても動作します。

## テスト

```bash
npm run check     # 型チェック
npm test          # ユニットテスト（Vitest）
npm run test:e2e  # E2Eテスト（Playwright、ビルド＋プレビューサーバーを自動起動）
```

## データの保存場所

- 入力内容: ブラウザの `localStorage`（キー: `income-wall-simulator:input:v1`）
- サーバーへの送信は一切行いません（本アプリは完全に静的ファイルのみで構成されています）

## しきい値（年収の壁）について

本アプリが表示する金額は `src/thresholds.ts` に定義されています。税制・社会保険制度は変更される
可能性があるため、最終判断の前には必ず国税庁・厚生労働省の最新の公表情報をご確認ください
（詳細は `docs/DESIGN.md` および画面内の免責事項を参照）。

## ドキュメント

- 要件・画面・データモデル: [`docs/DESIGN.md`](./docs/DESIGN.md)
- デバッグ3ラウンドの記録: [`docs/DEBUG_LOG.md`](./docs/DEBUG_LOG.md)
- サードパーティライセンス一覧: [`docs/THIRD_PARTY_LICENSES.md`](./docs/THIRD_PARTY_LICENSES.md)
- 公開手順（人間向け）: [`docs/RELEASE.md`](./docs/RELEASE.md)
- マーケ素材: [`docs/marketing/`](./docs/marketing/)
