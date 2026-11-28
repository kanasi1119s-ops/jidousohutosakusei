# ふるさと納税 上限額シミュレーター

給与所得者向けに、2026年（令和8年）の寄附における**控除上限額の目安**を試算するブラウザ完結のWebサイトです。

- サイト形態: **W1（静的サイト／ブラウザ完結・PWA）**。サーバー不要
- 登録不要・オフライン動作・外部通信ゼロ（CSPで担保）
- 入力データはブラウザの localStorage にのみ保存。JSONで書き出し／読み込み、結果はCSV（BOM付きUTF-8）で出力可能

## 開発

```bash
npm ci
npm run dev        # 開発サーバー
npm run check      # 型チェック
npm test           # ユニットテスト (Vitest)
npm run build      # 型チェック + 静的ビルド (dist/)
npm run test:e2e   # E2E (Playwright。ビルドとプレビュー起動を自動で行う)
```

E2E初回は `npx playwright install chromium` が必要な場合があります。

## 制度パラメータ

`src/params.ts` に集約（基準日・出典メモ付き）。制度改正時はこのファイルのみ更新してください。
算式の前提・簡略化は `docs/DESIGN.md`、法務・要確認事項は `docs/LEGAL.md` を参照。

## 注意

結果は一般的な算式による概算の目安であり、控除額を保証しません。
