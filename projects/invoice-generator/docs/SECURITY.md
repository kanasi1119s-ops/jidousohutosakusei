# セキュリティチェック (2026-10-15)
- [x] `npm audit`: 0件
- [x] 秘密情報: トークン/キー形式のパターン検索で検出なし
- [x] OSSライセンス: 本番配布物の実行時依存はゼロ。開発依存は MIT/Apache-2.0/BSD/ISC/MPL-2.0(開発ツールの推移的依存のみ、配布物に含まれない)。GPL/AGPLなし → `THIRD_PARTY_LICENSES.md`
- [x] XSS: 画面はDOM APIとtextContentで構築、innerHTML不使用。E2Eで確認
- [x] CSP: `default-src 'self'` ほか。外部通信なし
- [x] インポート: JSON構造を検証、不正はエラー表示
- [x] CSVインジェクション: 先頭が `= + @ -` 等のセルを無効化
- 残課題: localStorageは端末内平文保存（共有PCでは非推奨である旨をサイトに明記済みではない→公開前に追記推奨）
