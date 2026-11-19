import { isInRange, isValidRegistrationNumber, type Item, type PriceMode, type Rounding, type TaxRate } from './calc'

export interface Invoice {
  schema: 1
  issuer: { name: string; registrationNumber: string; address: string; contact: string }
  clientName: string
  honorific: string
  number: string
  issueDate: string
  dueDate: string
  subject: string
  priceMode: PriceMode
  rounding: Rounding
  items: Item[]
  bank: string
  notes: string
}

export function todayIso(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function emptyItem(): Item {
  return { name: '', quantity: 1, unit: '式', unitPrice: 0, taxRate: 10 }
}

export function defaultInvoice(): Invoice {
  return {
    schema: 1,
    issuer: { name: '', registrationNumber: '', address: '', contact: '' },
    clientName: '',
    honorific: '御中',
    number: '',
    issueDate: todayIso(),
    dueDate: '',
    subject: '',
    priceMode: 'exclusive',
    rounding: 'floor',
    items: [emptyItem()],
    bank: '',
    notes: '',
  }
}

const str = (v: unknown, def = ''): string => (typeof v === 'string' ? v : def)

/** 不明なデータを検証して Invoice にする。不正なら Error を投げる。 */
export function parseInvoice(raw: unknown): Invoice {
  if (typeof raw !== 'object' || raw === null) throw new Error('ファイルの形式が不正です（オブジェクトではありません）。')
  const o = raw as Record<string, unknown>
  if (o.schema !== 1) throw new Error('ファイルの形式が不正です（schema が 1 ではありません）。')
  if (!Array.isArray(o.items)) throw new Error('ファイルの形式が不正です（items が配列ではありません）。')
  if (o.items.length > 500) throw new Error('明細が多すぎます（上限500行）。')
  const items: Item[] = o.items.map((x, i) => {
    const it = (x ?? {}) as Record<string, unknown>
    const q = it.quantity
    const p = it.unitPrice
    if (typeof q !== 'number' || !Number.isFinite(q) || typeof p !== 'number' || !Number.isFinite(p)) {
      throw new Error(`ファイルの形式が不正です（明細${i + 1}の数量または単価が数値ではありません）。`)
    }
    if (!isInRange(q, p)) throw new Error(`ファイルの形式が不正です（明細${i + 1}の数量または単価が範囲外です）。`)
    const rate = it.taxRate
    if (rate !== 10 && rate !== 8 && rate !== 0) {
      throw new Error(`ファイルの形式が不正です（明細${i + 1}の税率が不正です）。`)
    }
    return { name: str(it.name), quantity: q, unit: str(it.unit), unitPrice: p, taxRate: rate as TaxRate }
  })
  const iss = (o.issuer ?? {}) as Record<string, unknown>
  const priceMode: PriceMode = o.priceMode === 'inclusive' ? 'inclusive' : 'exclusive'
  const rounding: Rounding = o.rounding === 'round' || o.rounding === 'ceil' ? o.rounding : 'floor'
  return {
    schema: 1,
    issuer: {
      name: str(iss.name),
      registrationNumber: str(iss.registrationNumber),
      address: str(iss.address),
      contact: str(iss.contact),
    },
    clientName: str(o.clientName),
    honorific: str(o.honorific, '御中'),
    number: str(o.number),
    issueDate: str(o.issueDate),
    dueDate: str(o.dueDate),
    subject: str(o.subject),
    priceMode,
    rounding,
    items: items.length > 0 ? items : [emptyItem()],
    bank: str(o.bank),
    notes: str(o.notes),
  }
}

/** 適格請求書として不足している可能性がある点（警告。保存・印刷は妨げない）。 */
export function validateInvoice(inv: Invoice): string[] {
  const w: string[] = []
  if (inv.issuer.name.trim() === '') w.push('発行者の氏名または名称が未入力です。')
  if (inv.issuer.registrationNumber.trim() === '') {
    w.push('登録番号が未入力です（適格請求書として発行する場合は T + 数字13桁が必要です）。')
  } else if (!isValidRegistrationNumber(inv.issuer.registrationNumber)) {
    w.push('登録番号の形式が不正です（T + 数字13桁）。')
  }
  if (inv.clientName.trim() === '') w.push('宛名（請求先）が未入力です。')
  if (inv.issueDate === '') w.push('発行日（取引年月日の目安）が未入力です。')
  if (inv.items.every((it) => it.name.trim() === '')) w.push('品名（取引内容）が1件も入力されていません。')
  if (inv.items.some((it) => it.name.trim() !== '' && it.taxRate === 8)) {
    // 軽減税率の旨は印刷物の「※」で明示される。情報のみ。
  }
  return w
}

/** ファイル名用に英数字・ハイフン・アンダースコアのみへ整形。 */
export function safeFileStem(number: string, date: string): string {
  const n = number.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40)
  const d = date.replace(/[^0-9-]/g, '')
  return ['invoice', n, d].filter((s) => s !== '').join('-')
}
