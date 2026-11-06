# 請求書メーカー（invoice-maker）

インボイス（適格請求書）の記載事項に対応した請求書を作成し、印刷／PDF保存できるWebサイト。**登録不要・オフライン対応・入力データはブラウザ外に送信されません。**（サイト形態: W1 静的サイト/PWA）

## 起動・テスト・ビルド
```bash
npm ci
npm run dev        # 開発サーバー
npm run check      # 型チェック
npm test           # 単体テスト(Vitest)
npm run test:e2e   # E2E(Playwright。初回は npx playwright install chromium)
npm run build      # dist/ に静的ファイルを生成（相対パスなのでサブディレクトリ配置可）
```

## データの保存場所
ブラウザの localStorage（キー `invoice-maker-v1`）。共有PCでは利用後に消去してください。バックアップは「データをJSONで書き出し」。

## 公開
`docs/RELEASE.md` を参照（公開は人間が行います）。
