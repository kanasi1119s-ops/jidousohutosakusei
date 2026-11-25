# ふるさと納税 控除上限額シミュレーター

給与収入と家族構成から、2026年中のふるさと納税の控除上限額の「目安」を試算する静的Webサイトです（サイト形態: W1 ブラウザ完結）。

- 登録不要・サーバー不要。入力データはブラウザ内（localStorage）にのみ保存され、外部送信しません（CSPで担保）。
- PWA対応。一度開けばオフラインでも動きます。
- 設定のJSONエクスポート／インポート、結果のCSVダウンロード（BOM付きUTF-8）に対応。

## ローカル起動

```bash
npm ci
npm run dev        # 開発サーバー
npm run check      # 型チェック
npm test           # ユニットテスト(Vitest)
npm run build      # dist/ に静的ファイルを出力
npm run preview    # ビルド成果物を配信
npm run test:e2e   # E2E(Playwright。初回は npx playwright install chromium)
```

## データの保存場所
ブラウザの localStorage（キー `furusato-limit-simulator:input:v1`）。端末を変える場合はJSONエクスポートを使ってください。

## 注意
本ツールは目安の提供であり、税務上の助言ではありません。対応範囲・前提は `docs/DESIGN.md` と `docs/LEGAL.md` を参照してください。
