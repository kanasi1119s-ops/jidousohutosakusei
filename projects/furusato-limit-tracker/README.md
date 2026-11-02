# ふるさと納税 上限＆記録ノート（furusato-limit-tracker）

ふるさと納税の**控除上限額の目安**を試算し、今年の**寄附を記録して残り枠**（上限までの金額・自治体数・ワンストップ特例の条件）を確認する、ブラウザ完結の静的Webサイトです。

- サイト形態: **W1（静的サイト／PWA）** — サーバー不要
- 登録不要・入力データは外部送信しない（CSPで外部通信を禁止）・オフライン動作
- データの保存場所: ブラウザの `localStorage`（この端末のみ）。CSV／JSONでバックアップ可能

## ローカル起動

```bash
npm ci
npm run dev        # 開発サーバー
```

## テスト・ビルド

```bash
npm run check      # 型チェック
npm test           # ユニットテスト（Vitest）
npm run build      # dist/ に静的ファイルを生成
npm run test:e2e   # E2E（Playwright。初回は npx playwright install chromium）
```

## ドキュメント

`docs/DESIGN.md`（設計）/ `docs/DEBUG_LOG.md` / `docs/SECURITY.md` / `docs/LEGAL.md` / `docs/RELEASE.md`（公開手順）/ `docs/marketing/`（LP・SNS文案）
