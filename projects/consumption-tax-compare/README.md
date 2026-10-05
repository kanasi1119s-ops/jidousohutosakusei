# 消費税 納税額比較シミュレーター (consumption-tax-compare)

インボイス制度の経過措置見直し（2割特例の終了・3割特例の新設・7割控除への移行）を踏まえ、
個人事業者の消費税納税額を **本則課税 / 簡易課税 / 2割特例 / 3割特例** で並べて比較する、ブラウザ完結型の Web サイトです。

## サイト形態

**W1: 静的サイト／ブラウザ完結Webアプリ**（サーバー不要）。ビルド後は静的ファイルのみで動作します。

## 特長

- 登録不要・アカウント不要
- 入力データは外部送信されず、この端末のブラウザ内（`localStorage`）にのみ保存されます
- PWA対応。一度開けばオフラインでも利用できます
- 設定のJSONエクスポート/インポート、結果のCSVダウンロード（Excelで文字化けしないBOM付きUTF-8）
- 外部CDN・外部フォント・アクセス解析なし（CSPで外部通信を禁止）

## ローカル起動手順

```bash
npm install
npm run dev
```

## ビルド・テスト

```bash
npm run build        # 型チェック + 静的ビルド（dist/）
npm run preview      # ビルド結果の確認
npm run check        # 型チェック
npm test             # ユニットテスト（Vitest）
npx playwright test  # E2E（初回は npx playwright install chromium が必要）
```

## データの保存場所

ブラウザの `localStorage`（キー: `consumption-tax-compare:input:v1`）のみ。バックアップは画面の「設定をエクスポート(JSON)」で行えます。

## 制度パラメーターの更新

`src/rules.ts` に集約しています（みなし仕入率、経過措置の控除割合、特例の適用年分、基準日、出典）。
更新時は `docs/LEGAL.md` の出典・基準日も合わせて更新してください。

## 注意

試算は一般的な目安であり、税務申告や税理士による相談に代わるものではありません（詳細は `docs/LEGAL.md`）。
