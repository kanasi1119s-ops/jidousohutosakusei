# セキュリティチェック（Phase 5）

- [x] `npm audit`: 0件（2026-10-25）
- [x] 秘密情報の混入: 代表的なトークン/鍵パターンを grep で検査し検出なし（gitleaks は環境に無く未実施）
- [x] OSSライセンス: `docs/THIRD_PARTY_LICENSES.md` 参照。本番配布物に含まれる依存は **ゼロ**。開発ツールにGPL/AGPLなし
- [x] XSS: `innerHTML` / `eval` / `document.write` 不使用（grepで確認）。E2Eで `<img onerror>` が実行されないことを確認
- [x] CSP: `default-src 'self'` で外部通信を遮断（meta タグ）
- [x] インポートファイル検証: アプリ識別子・型・文字数・件数（1000件、5MB）を制限
- [x] CSVインジェクション対策: ユニットテストあり
- 残課題: CSPは meta タグのため `frame-ancestors` 等は効かない。ホスティング側のHTTPヘッダ設定は公開時に人間が検討
