# Changelog

## [0.1.0] - 2026-09-23
### Added
- 年収の壁シミュレーター MVP を実装（時給・週労働時間から6種類の壁との比較、週あたり上限時間の目安を算出）
- 設定のJSONエクスポート/インポート、結果のCSVダウンロード（BOM付きUTF-8）
- PWA対応（manifest・Service Workerによるオフラインキャッシュ）
- ユニットテスト（Vitest 8件）・E2Eテスト（Playwright 24件、デスクトップ/モバイル）を追加
- Content-Security-Policy（外部通信ゼロを技術的に担保）を追加
- GitHub Actions CI（型チェック・ユニットテスト・ビルド・E2Eテスト）を追加

### Fixed
- オフライン時にService Workerがビルド済みのハッシュ付きJS/CSSを配信できず画面が真っ白になる不具合を修正
- ページ再読み込み時、モジュールスクリプトのリクエストが`cache.match()`でキャッシュにヒットせず
  オフラインで読み込みに失敗する不具合を修正（URL文字列によるマッチングに変更）
- 依存パッケージの脆弱性5件（vite/vitest系）を解消（`npm audit` 0件）
