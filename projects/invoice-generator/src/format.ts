export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export function yen(n: number): string {
  const body = Math.abs(n).toLocaleString('ja-JP')
  return (n < 0 ? '-' : '') + '¥' + body
}

/** 'YYYY-MM-DD' → 'YYYY年M月D日' */
export function jpDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${m[1]}年${Number(m[2])}月${Number(m[3])}日` : ''
}

/** ファイル名に使える英数字・ハイフン・アンダースコアのみへ */
export function safeFileToken(s: string): string {
  const t = s.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
  return t || 'invoice'
}
