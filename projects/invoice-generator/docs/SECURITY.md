# セキュリティチェックリスト（Phase 5）

- [x] 依存パッケージの脆弱性チェック: `npm audit` — **0件**（High/Critical含め検出なし。本番ビルドに含まれるnpmパッケージはゼロ、devDependenciesのみ）
- [x] 秘密情報の混入チェック: コミット予定のdiff・作業ディレクトリにAPIキー・トークン・パスワード・個人情報の記載なし。`.env`ファイルは使用していない（外部APIを使わない設計のため`.env.example`も不要）
- [x] OSSライセンス一覧: `license-checker --summary` で確認（MIT 83 / Apache-2.0 7 / MPL-2.0 3 / ISC 3 / BSD-2-Clause 2 / BSD-3-Clause 2 / MIT-0 1）。GPL/AGPL等の強いコピーレフトは検出なし。全て devDependencies（ビルドツール）であり、配布物（`dist/`の静的ファイル）には一切含まれない。詳細は `docs/THIRD_PARTY_LICENSES.md`
- [x] XSSの扱い: ユーザー入力（取引先名・住所、品目名、備考等）を`innerHTML`で描画する箇所は全て `escapeHtml()`（`src/util.ts`）でエスケープしてから埋め込む。HTMLタグ・引用符を含む入力でスクリプトが実行されないことをE2Eで確認済み（`e2e/round2-edge-cases.spec.ts`）
- [x] Content-Security-Policy: `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; manifest-src 'self'; base-uri 'self'; form-action 'self'; connect-src 'self'` を`index.html`に設定。外部通信を技術的に禁止し、外部からのスクリプト読み込みも拒否
- [x] インポート機能の入力検証: JSONバックアップのインポート（`parseAppDataFromJsonText`）は構造（`formatVersion`・必須フィールドの型）を検証し、不正な形式はエラーとして拒否してから取り込む
- [x] W2（サーバー付き）固有のチェック: 本プロジェクトはW1（静的サイト）のためサーバーサイドの認証・CSRF・SQLインジェクション等は対象外
