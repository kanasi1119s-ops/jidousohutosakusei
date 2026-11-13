# 公開手順書（人間が実行）
本ツールはこのサイクルでは**どこにも公開していません**。
1. 公開判断: `docs/LEGAL.md` の★項目（一次情報・公式式との突合）を完了する
2. ビルド: `npm ci && npm run build` → `dist/` が静的ファイル一式（相対パス）
3. ZIP化（英数字名）: `cd dist && zip -r ../furusato-limit-simulator.zip .`
4. 配信（いずれか。人間が実施）
   - GitHub Pages: リポジトリを public 化／Pages有効化後、`.github/workflows/deploy-pages-furusato.yml` を `workflow_dispatch` で実行（※既存の deploy-pages.yml は年収の壁用）
   - Cloudflare Pages 等: `dist/` をアップロード
5. 公開後確認: 日本語表示、オフライン動作（一度開いて機内モードで再読込）、CSVをExcelで開いて文字化けしないこと
6. 寄附期限（12/31）前の公開が望ましい（季節需要）
