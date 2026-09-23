# 公開手順（人間向け）

このドキュメントは、本サイトを実際に公開するために**人間が実行する必要がある手順**を
まとめたものです。オーケストレーター自身はこれらの操作を行いません（運用指示書の
安全装置に基づく）。

## 1. 事前確認

- [ ] `docs/DEBUG_LOG.md` の重大度「高」が0件であることを確認済みか
- [ ] `docs/LEGAL_REVIEW.md` の残課題（プライバシーポリシー・利用規約の最終文言）を確認したか
- [ ] `docs/legal/PRIVACY_POLICY_DRAFT.md` / `TERMS_OF_USE_DRAFT.md` の内容を確認・確定したか
- [ ] `LICENSE` のライセンス方針（OSS化 or 独自ライセンス）を確定したか

## 2. リポジトリのpublic化（必要な場合のみ・人間の判断）

GitHubリポジトリの Settings → General → Danger Zone → Change visibility から実行。

## 3. ローカルでの最終ビルド確認

```bash
npm ci
npm run check          # lint + typecheck + unit test
npx playwright install --with-deps chromium
npm run test:e2e
npx vite build
npx vite preview        # http://localhost:4173 で目視確認
```

## 4. 静的ホスティングへの公開（いずれか一つ・人間が実行）

### 4-A. GitHub Pages を使う場合

1. GitHubリポジトリの Settings → Pages で、Source を「GitHub Actions」に設定して有効化する。
2. `.github/workflows/deploy-pages.yml`（`workflow_dispatch`のみで自動実行はされない）を
   Actionsタブから手動実行(Run workflow)する。
3. 公開後のURLは `https://<owner>.github.io/<repo>/` になる。`vite.config.ts`の
   `base: './'`設定により、サブディレクトリ配置でも相対パスで動作する。

### 4-B. Cloudflare Pages / Netlify / Vercel 等を使う場合

1. `npm run build` で生成される `dist/` ディレクトリをビルド成果物として登録する。
2. ビルドコマンド: `npm ci && npx vite build` / 公開ディレクトリ: `dist`
3. 各サービスへの接続・本番デプロイの実行は人間が行う（本サイトはサーバー不要のため、
   環境変数の設定は不要）。

## 5. 静的ファイル一式のZIP配布（オフライン配布・審査用等）

```bash
npm run build
cd dist
zip -r ../furusato-sim-dist.zip .
```

ZIP内・ダウンロードファイル名はすべて英数字のみとし、日本語ファイル名は使用しない
（Windows環境でのZIP展開時の文字化けを防ぐため）。

## 6. 公開後の確認

- [ ] 実際のURLでスマホ・PC両方の表示を確認
- [ ] Service Workerが正しく登録され、2回目以降オフラインでも開けることを確認
- [ ] CSVエクスポートをExcelで開いて文字化けしないことを確認
