export type TaxRate = 10 | 8
export type Rounding = 'floor' | 'round' | 'ceil'

export interface LineItem {
  name: string
  quantity: number
  unitPriceYen: number
  taxRate: TaxRate
}

export interface Issuer {
  name: string
  registrationNumber: string
  address: string
  contact: string
  bankInfo: string
}

export interface Invoice {
  id: string
  number: string
  issueDate: string
  dueDate: string
  clientName: string
  items: LineItem[]
  rounding: Rounding
  withholding: boolean
  notes: string
}

export interface AppData {
  version: 1
  issuer: Issuer
  invoices: Invoice[]
}
