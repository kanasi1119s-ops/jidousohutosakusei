# サードパーティ ライセンス一覧

## 本番出力(dist/)に含まれるコード

本サイトは `dependencies`(実行時依存)を一切持たず、`devDependencies`(ビルド・テスト
専用ツール)のみで構成されている。`npx license-checker --production` の結果は
`UNLICENSED: 1`（本パッケージ自身のみ）であり、ビルド後の `dist/` にはこのプロジェクト
自身が書いたHTML/CSS/JSと、Service Worker生成用ライブラリ(Workbox, MIT License)が
生成したコードのみが含まれる。**サードパーティの実行時ライブラリはゼロ**。

## 開発時依存(devDependencies)のライセンス集計

`npx license-checker --summary` の結果（2026年サイクル時点、合計494パッケージ）:

| ライセンス | 件数 | コピーレフトか |
|---|---|---|
| MIT | 414 | いいえ |
| ISC | 29 | いいえ |
| Apache-2.0 | 17 | いいえ |
| BSD-2-Clause | 11 | いいえ |
| BSD-3-Clause | 8 | いいえ |
| BlueOak-1.0.0 | 8 | いいえ |
| MIT-0 | 2 | いいえ |
| MPL-2.0 | 2 | 弱いコピーレフト(ファイル単位) |
| (MIT OR CC0-1.0) | 2 | いいえ |
| Python-2.0 | 1 | いいえ |
| CC-BY-4.0 | 1 | いいえ(表示義務のみ) |
| CC0-1.0 | 1 | いいえ |
| UNLICENSED | 1 | 本パッケージ自身 |

**GPL・AGPL等の強いコピーレフトライセンスは0件。**

- `MPL-2.0`（`lightningcss`, `lightningcss-linux-x64-gnu`）: Viteのビルド時CSS処理に
  使われるツール本体であり、そのソースコードを改変していないため、MPL-2.0の
  ソース開示義務は発生しない。ビルド出力(dist/)にlightningcss自体のソースは含まれない。
- `CC-BY-4.0`（`caniuse-lite`）: ブラウザ対応表データ。ビルド時にのみ参照され、
  出力物に同梱されない。

## 依存パッケージの脆弱性（`npm audit`）

- 初回インストール時点で `vite`/`vitest`/`vite-plugin-pwa` の推移的依存に
  moderate〜critical（開発サーバーのみに影響する既知の脆弱性）が6件検出された。
  いずれも**開発サーバー限定の脆弱性**（本番ビルド後の静的ファイルには影響しない）
  だったが、`vite@8.3.0` / `vitest@5.0.1` / `vite-plugin-pwa@1.3.0` に更新し、
  **`npm audit` の結果を0件**まで解消した。
- 更新後も `npm run check`（lint・型チェック・テスト）およびPlaywright E2E
  （18件）が全件成功することを確認済み。

## 秘密情報の混入チェック

- リポジトリ内の全追跡ファイルに対し、APIキー・トークン・秘密鍵などの典型的な
  パターン（AWSキー、GitHub PAT、Slackトークン、PEM秘密鍵ブロック等）を
  正規表現で走査し、該当なしを確認した。
- `.env.example` にはキー名の例のみを記載し、実際の値は含まない。

## XSS・入力データの扱い

- `innerHTML`を使用している箇所は2箇所（`src/main.ts`）。いずれも、固定の
  日本語ラベル・数値・このアプリ自身が生成したISO日付文字列のみを差し込み、
  ユーザーが自由入力したテキストを直接HTMLとして描画する箇所は現時点で存在しない
  （保存記録の `memo` フィールドはデータモデル上は保持できるが、今回のMVPでは
  入力・表示UIを設けていないため、実質的にXSSの入力経路は無い）。将来 `memo` の
  入力UIを追加する場合は、`textContent`経由での描画、またはHTMLエスケープを
  必須とすること（残課題としてBACKLOGに記載）。
- CSVインポートはJSON形式のみを受け付け、`JSON.parse`が失敗した入力は例外として
  拒否し、既存データを破壊しない（ユニットテストで確認済み）。

## Content-Security-Policy

- `index.html`に以下のCSPを設定し、外部通信ゼロという設計方針をブラウザレベルで
  強制している:
  `default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`
