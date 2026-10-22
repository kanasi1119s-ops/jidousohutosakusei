import type { LineInput, RoundingMode } from './calc'

export type DocType = 'invoice' | 'quote' | 'delivery' | 'receipt'

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  invoice: '請求書',
  quote: '見積書',
  delivery: '納品書',
  receipt: '領収書',
}

export interface IssuerInfo {
  name: string
  address: string
  contact: string
  registrationNumber: string
  bankInfo: string
}

export interface InvoiceDoc {
  id: string
  docType: DocType
  number: string
  issueDate: string
  dueDate: string
  clientName: string
  items: LineInput[]
  rounding: RoundingMode
  withholding: boolean
  notes: string
  updatedAt: string
}

export interface AppData {
  version: 1
  issuer: IssuerInfo
  docs: InvoiceDoc[]
  draft: InvoiceDoc | null
}

export function emptyIssuer(): IssuerInfo {
  return { name: '', address: '', contact: '', registrationNumber: '', bankInfo: '' }
}

export function newId(): string {
  const rnd = Math.random().toString(36).slice(2, 10)
  return `d${Date.now().toString(36)}${rnd}`
}

export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function emptyDoc(now: Date = new Date()): InvoiceDoc {
  return {
    id: newId(),
    docType: 'invoice',
    number: '',
    issueDate: todayIso(now),
    dueDate: '',
    clientName: '',
    items: [{ description: '', quantity: '1', unitPrice: '', taxRate: 10 }],
    rounding: 'floor',
    withholding: false,
    notes: '',
    updatedAt: now.toISOString(),
  }
}
