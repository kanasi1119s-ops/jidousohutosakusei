# furusato-limit-ledger（ふるさと納税 上限額＆寄付台帳）

ふるさと納税の**控除上限額の目安**を試算し、**寄付先・金額・ワンストップ特例の申請書送付状況**を管理する、ブラウザ完結の静的Webサイトです。

- サイト形態: **W1**（静的サイト／PWA。サーバー不要）
- 登録不要・外部通信ゼロ（CSPで担保）・オフライン対応
- データ保存先: ブラウザの localStorage（JSON／CSVでエクスポート・インポート可能）

## 主な機能
1. 給与所得者向け控除上限額の目安（配偶者控除・扶養・その他所得控除に対応）
2. 寄付台帳（日付・自治体・金額・ワンストップ/確定申告・送付済みチェック）
3. 上限までの残額、ワンストップ特例の5自治体チェック、12/31・1/10必着の残日数表示
4. CSV（BOM付きUTF-8）/ JSON のバックアップと復元

## 開発
```bash
npm ci
npm run dev        # 開発サーバー
npm run check      # 型チェック
npm test           # ユニットテスト（Vitest）
npm run build      # 静的ビルド（dist/）
npm run test:e2e   # E2E（Playwright。要: npx playwright install chromium）
```

## 免責
一般的な試算ツールであり、税務上の助言ではありません。詳細は `docs/LEGAL.md`。
