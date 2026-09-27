export interface NumberingState {
  prefix: string
  nextNumber: number
}

export const DEFAULT_NUMBERING: NumberingState = {
  prefix: 'INV-2026',
  nextNumber: 1,
}

export function formatInvoiceNumber(state: NumberingState): string {
  const digits = String(state.nextNumber).padStart(4, '0')
  const prefix = state.prefix.trim() || 'INV'
  return `${prefix}-${digits}`
}

export function advanceNumbering(state: NumberingState): NumberingState {
  return { ...state, nextNumber: state.nextNumber + 1 }
}

export function validatePrefix(prefix: string): string[] {
  if (!prefix.trim()) return ['請求書番号の接頭辞を入力してください。']
  if (!/^[A-Za-z0-9-]+$/.test(prefix.trim())) {
    return ['請求書番号の接頭辞は半角英数字とハイフンのみ使用できます。']
  }
  return []
}
