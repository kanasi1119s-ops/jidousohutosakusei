# 消費税 特例比較シミュレーター

インボイス登録した**個人事業者**向けに、消費税の納付税額を 本則課税 / 簡易課税 / 2割特例（〜2026年分） / 3割特例（2027〜2028年分）で比較するブラウザ完結のWebサイトです。

- サイト形態: **W1**（静的サイト・PWA）。サーバー不要、外部通信ゼロ（CSPで担保）、オフライン動作
- データ保存先: ブラウザの localStorage のみ。JSONエクスポート/インポート、CSV（BOM付きUTF-8）ダウンロード対応
- 重要: 制度要件は二次情報に基づく目安です。公開前に `docs/LEGAL.md` の確認事項を実施してください

## 開発

```bash
npm ci
npm run dev        # 開発サーバー
npm run verify     # 型チェック + ユニットテスト + ビルド + E2E
npm run build      # dist/ に静的ファイルを出力（相対パスのためサブディレクトリ配置可）
```

E2E初回は `npx playwright install chromium` が必要な場合があります。公開手順は `docs/RELEASE.md`、設計は `docs/DESIGN.md`。
