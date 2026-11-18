# セキュリティ検査（Phase 5）

- [x] `npm audit`: 5件(high)が残存。いずれも開発・ビルド専用ツール（vite/vitest→tinyglobby→fdir→picomatch の ReDoS）。
      `npm audit fix` は失敗し、`--force` は vitest のダウングレード（破壊的）となるため適用せず。**配布物（dist）に依存パッケージは含まれない**。
      上流の修正版が出たら更新（バックログ化）。※残課題として人間が把握すること
- [x] 秘密情報: ソース・設定に APIキー等なし（`git grep -iE "api[_-]?key|secret|token|password"` で確認。gitleaks は環境に無く未実施）
- [x] OSSライセンス: `docs/THIRD_PARTY_LICENSES.md`。GPL/AGPL なし。MPL-2.0（lightningcss、開発時のみ・非同梱）
- [x] XSS: `innerHTML` は固定テンプレートと数値整形済みの年収別表のみ。ユーザー入力文字列は DOM に埋め込まない（エラー文は textContent）
- [x] インポート検証: JSON は型・有限数値・真偽値を厳格検証。不正は拒否
- [x] CSP: `default-src 'self'; connect-src 'self'` 等で外部通信を遮断
- [x] W2 該当なし（サーバー無し）
