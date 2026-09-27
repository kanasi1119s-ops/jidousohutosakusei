# サードパーティライセンス一覧

`license-checker` (`npx license-checker --csv`) による全依存パッケージ（devDependencies経由の推移依存を含む）のライセンス一覧。**いずれもビルドツール・テストツールとしての使用であり、配布物（`dist/`の静的HTML/CSS/JS）には一切バンドルされない。** 実行時（ブラウザで配信されるコード）の外部npm依存はゼロ。

GPL/AGPL等の強いコピーレフトライセンスは含まれていない。`lightningcss`系（3パッケージ）がMPL-2.0（ファイル単位の弱いコピーレフト）だが、これはVite内部が利用するCSS変換ツールであり、本プロジェクトのソースコードを配布・改変する義務は生じない。

| ライセンス | 件数 |
|---|---|
| MIT | 83 |
| Apache-2.0 | 7 |
| MPL-2.0 | 3 |
| ISC | 3 |
| BSD-2-Clause | 2 |
| BSD-3-Clause | 2 |
| MIT-0 | 1 |
| UNLICENSED（自パッケージ、非公開） | 1 |

主なツール:
- `vite` (MIT), `vitest` (MIT), `@playwright/test` / `playwright` (Apache-2.0), `typescript` (Apache-2.0), `jsdom` (MIT), `lightningcss` (MPL-2.0, Vite内部で利用)

全件のCSVは `npx license-checker --csv` を実行することで再生成できる（本ファイルは実行結果を要約したもの）。
