# セキュリティ検査記録（2026-10-18）

| 項目 | 結果 |
|---|---|
| `npm audit` | **0件**（high以上なし） |
| 実行時依存パッケージ | **ゼロ**（`npm ls --prod` が空）。開発ツールのみ |
| 秘密情報の混入 | grep による検査で検出なし（`gitleaks` は環境に無く未実施。公開前に人間側で `gitleaks` 等の実行を推奨） |
| `innerHTML` の使用 | `src/main.ts` の初期レイアウト（固定文字列）1箇所のみ。ユーザー入力は常に `textContent` / `createTextNode` 経由 |
| XSS | E2Eで `<img onerror>` / `<script>` を入力しても実行・要素化されないことを確認 |
| CSP | `default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'` 等。外部通信は発生しない |
| インポート検証 | バックアップJSONは `app` 識別子を確認し、全フィールドを型・長さ・列挙値で検証／丸め込み（最大500書類・200明細） |
| CSVインジェクション | `=` `+` `-` `@` で始まる文字列セルは先頭に `'` を付与（数値は除外） |
| Service Worker | 同一オリジンのGETのみキャッシュ |
| W2向け項目 | 該当なし（サーバーなし） |

残課題: 公開後にホスティング側で `Content-Security-Policy` ヘッダも付与できるなら二重化を推奨（現状は meta タグ）。
