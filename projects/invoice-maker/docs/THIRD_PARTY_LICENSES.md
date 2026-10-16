# サードパーティライセンス

## 本番配布物（dist/）
実行時依存パッケージは**ゼロ**（バンドルされるのは本リポジトリのソースのみ）。外部フォント・CDN・画像素材も不使用（アイコンは自作SVG）。

## 開発時依存（配布物に含まれない）
`license-checker` による集計（devDependencies含む）: MIT 82 / Apache-2.0 7 / ISC 3 / BSD-2-Clause 2 / BSD-3-Clause 2 / MPL-2.0 2 / MIT-0 1。
- MPL-2.0: `lightningcss`（Viteの内部依存）。ビルドツールであり配布物に含まれず、改変もしていないため影響なし。
- GPL / AGPL: なし。
