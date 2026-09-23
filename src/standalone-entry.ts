import { render } from './main'

// ダブルクリック(file://)でそのまま開けるローカル確認用エントリーポイント。
// Service Worker登録・manifest参照は行わない(file://では機能しないため)。
render()
