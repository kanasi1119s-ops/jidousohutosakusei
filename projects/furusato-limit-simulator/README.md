# ふるさと納税 上限額シミュレーター

給与所得者（会社員・パート等）向けに、自己負担2,000円で済む寄附上限額の**目安**を試算する静的Webサイトです。

- サイト形態: **W1（静的サイト／ブラウザ完結、PWA）**。サーバー不要
- 登録不要・入力データは外部送信なし（CSPで `connect-src 'self'` に制限）・オフライン動作
- 入力はこの端末のブラウザ（localStorage）にのみ保存。JSONエクスポート/インポート、CSV出力（BOM付きUTF-8）に対応

## 使い方（開発）
```bash
npm ci
npm run dev        # 開発サーバー
npm run check      # 型チェック
npm test           # ユニットテスト（Vitest）
npm run build      # 本番ビルド（dist/）
npm run preview    # ビルド成果物の確認
npm run test:e2e   # E2E（Playwright。初回は `npx playwright install chromium`）
```

## データの保存場所
ブラウザの localStorage（キー: `furusato-limit-simulator:input:v1`）のみ。サーバーには送信されません。

## 計算モデル
`src/calc.ts` を参照。令和8年（2026年）分を想定した簡易モデルで、給与所得控除・基礎控除・配偶者/扶養控除・調整控除を考慮し、
`上限額 = 住民税所得割額 × 20% ÷ (90% − 所得税率 × 1.021) + 2,000円` で算出します。詳細な前提と制約は `docs/DESIGN.md`。

## 免責
一般的な目安であり、税務上の助言ではありません。公開前の法務確認事項は `docs/LEGAL.md` を参照。
