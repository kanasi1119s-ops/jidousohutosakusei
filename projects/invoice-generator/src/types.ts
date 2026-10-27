export type TaxRate = 0 | 8 | 10
export type PriceMode = 'exclusive' | 'inclusive'
export type RoundingMode = 'floor' | 'round' | 'ceil'
export type Honorific = '御中' | '様'

export interface LineItem {
  id: string
  name: string
  quantity: number
  unitPrice: number
  taxRate: TaxRate
}

export interface Issuer {
  name: string
  registrationNumber: string
  postalCode: string
  address: string
  phone: string
  email: string
  bankInfo: string
}

export interface Invoice {
  id: string
  invoiceNumber: string
  issueDate: string
  transactionDate: string
  dueDate: string
  subject: string
  issuer: Issuer
  clientName: string
  honorific: Honorific
  items: LineItem[]
  priceMode: PriceMode
  rounding: RoundingMode
  withholdingEnabled: boolean
  notes: string
  updatedAt: string
}

export interface AppData {
  version: 1
  defaultIssuer: Issuer
  draft: Invoice
  saved: Invoice[]
}
