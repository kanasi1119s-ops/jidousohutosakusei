# ふるさと納税 上限額シミュレーター (furusato-limit-simulator)

給与収入から、自己負担2,000円で寄附できる控除上限額の目安を試算する、ブラウザ完結型の Web サイトです。

## サイト形態

**W1: 静的サイト／ブラウザ完結Webアプリ**（サーバー不要）。ビルド後は静的ファイルのみで動作し、
GitHub Pages や Cloudflare Pages など任意の静的ホスティングにそのまま配置できます。

## 特長

- 登録不要・アカウント不要
- 入力データは外部送信されず、この端末のブラウザ内（`localStorage`）にのみ保存されます
- PWA対応（Service Workerによるオフラインキャッシュ）
- 設定のJSONエクスポート/インポート、結果のCSVダウンロード（Excelでも化けないBOM付きUTF-8）
- 全角数字・カンマ・「円」付きの入力に対応
- 年収別の目安早見表つき

## ローカル起動手順

```bash
npm ci
npm run dev
```

## ビルド手順

```bash
npm run build
npm run preview
```

成果物は `dist/`（相対パス構成。サブディレクトリ配置でも動作）。

## テスト

```bash
npm run check     # 型チェック
npm test          # ユニットテスト（Vitest）
npm run test:e2e  # E2E（Playwright。ビルド＋プレビューを自動起動）
```

## データの保存場所

- `localStorage`（キー: `furusato-limit-simulator:input:v1`）。サーバー送信なし。

## 計算モデルと制約

給与所得者・簡易モデルです。詳細は `docs/DESIGN.md` と `docs/LEGAL.md` を参照してください。
住宅ローン控除・医療費控除・副業・自営業・年金受給者、人的控除差額による調整控除の詳細は未対応です。
