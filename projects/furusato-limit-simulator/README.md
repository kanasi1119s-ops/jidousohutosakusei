# ふるさと納税 上限額シミュレーター

令和8年（2026年）中の寄附について、ふるさと納税の控除上限額の目安を試算し、寄附の合計・残り枠・ワンストップ特例の送付状況を管理する、**ブラウザ完結の静的Webサイト（形態 W1）**です。

- 登録不要・入力データは外部送信なし（CSPで外部通信を禁止）・オフラインでも動作（PWA）
- データの保存場所: ブラウザの localStorage のみ。JSONバックアップ／CSV出力に対応
- 給与所得者向けの簡易試算です。税務上の助言ではありません（`docs/LEGAL.md` 参照）

## 起動・テスト
```
npm install
npm run dev          # 開発サーバー
npm run check        # 型チェック
npm test             # ユニットテスト (Vitest)
npm run build        # 本番ビルド (dist/)
npm run test:e2e     # E2E (Playwright。初回は npx playwright install chromium)
npm run preview      # ビルド成果物の確認
```
`dist/` は相対パス（`base: './'`）なので任意のサブディレクトリに配置できます。公開手順は `docs/RELEASE.md`。

## 構成
- `src/params.ts` 税制パラメータ（改正時はここを更新） / `src/calc.ts` 計算 / `src/donations.ts` 寄附記録
- `src/csv.ts` CSV（BOM付きUTF-8） / `src/storage.ts` 保存・インポート検証 / `src/main.ts` UI
- 詳細: `docs/DESIGN.md`, `docs/DEBUG_LOG.md`, `docs/SECURITY.md`, `docs/LEGAL.md`
