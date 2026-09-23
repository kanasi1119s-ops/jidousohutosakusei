# セキュリティレビュー（Phase 5）

## チェックリスト

- [x] **依存パッケージの脆弱性チェック**: `npm audit` で5件（moderate 3 / high 1 / critical 1、
      いずれも `vite`/`vitest`/`esbuild` 等の開発ツール）を検出。`npm audit fix --force`
      （vite 5→8系、vitest 2→5系へのメジャーアップデート）を適用し **0件** に解消。
      アップデート後、型チェック・ユニットテスト8件・E2Eテスト24件が全て成功することを確認済み。
      対象はすべて開発時専用ツールであり、配布物（`dist/`、ユーザーが読み込むコード）には含まれない。
- [x] **秘密情報の混入チェック**: `grep -RniE "api[_-]?key|secret|password|token|BEGIN ... PRIVATE KEY"`
      をソース・設定ファイル全体に実行し、該当なし（`package-lock.json` 内のパッケージ名
      `@csstools/css-tokenizer` の誤検知のみ）。APIキー等を必要とする外部サービス連携は
      本アプリに存在しない（BYOK等も未実装。将来AI機能等を追加する場合はBYOK方式とし、
      キーはブラウザ内にのみ保存する設計とすること＝運用指示書3-1節の方針を踏襲）。
- [x] **OSSライセンス一覧**: `license-checker` で確認。詳細は `docs/THIRD_PARTY_LICENSES.md`。
      本番配布物に含まれる依存パッケージはゼロ、開発時ツールにコピーレフトライセンス（GPL/AGPL）は
      検出されなかった。
- [x] **ユーザー入力の扱い・XSS対策**:
  - `innerHTML` を使用している箇所（`src/main.ts` の初期テンプレート、結果テーブルの描画）は、
    いずれも固定文字列・静的な `THRESHOLDS` 定義・数値のフォーマット結果のみを埋め込んでおり、
    ユーザーが入力した文字列を直接HTMLとして描画する箇所は存在しない（入力欄は全て
    `type="number"` の数値、JSONインポートも数値フィールドのみを検証して取り込む設計）。
  - Content-Security-Policy を `index.html` に追加:
    `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; manifest-src 'self'; base-uri 'self'; form-action 'self'; connect-src 'self'`
    （外部通信ゼロを技術的に担保）。
  - CSPを `'unsafe-inline'` なしで有効化するため、HTML内のインラインstyle属性・`<style>`要素を
    廃止し、すべて `src/style.css`（ビルド後は外部CSSファイル）に移動。表示/非表示の切り替えは
    `.hidden` クラスのトグルに変更（Round時に発見: CSP適用時にインラインstyle属性が
    ブロックされファイル選択inputが常時表示されてしまう不具合を、実装時点で先回りして修正）。
- [x] **W1として外部通信ゼロであることの確認**: 上記CSPに加え、アプリコード内に `fetch()` を
      使用している箇所は Service Worker のキャッシュ管理（同一オリジンの静的ファイル取得）のみで、
      外部ドメインへの通信は一切行わない。アクセス解析等のトラッキングコードは未実装（オプトインで
      追加する場合も、初期状態はOFFとしプライバシー方針に明記すること）。

## 結論

すべての項目を確認済み。残課題はなし。将来的にAI機能や有料版のライセンス認証機能を追加する際は、
本ドキュメントの方針（BYOK、秘密鍵をリポジトリに置かない、Ed25519署名方式）に従うこと。
