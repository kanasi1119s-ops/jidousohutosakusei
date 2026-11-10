import { describe, it, expect } from 'vitest'
import { summarize, validateDonation, isValidDate, type Donation } from './ledger'

const d = (o: Partial<Donation>): Donation => ({ id: 'x', date: '2026-11-01', municipality: 'A市', amountYen: 10000, method: 'onestop', sent: false, ...o })

describe('台帳集計', () => {
  it('合計・残り・超過を計算する', () => {
    const s = summarize([d({}), d({ amountYen: 5000 })], 2026, 12000, '2026-11-10')
    expect(s.totalYen).toBe(15000); expect(s.overYen).toBe(3000); expect(s.remainingYen).toBe(0)
  })
  it('同一自治体は1自治体として数え、全角半角を同一視する', () => {
    const s = summarize([d({ municipality: 'Ａ市' }), d({ municipality: 'A市' })], 2026, 0, '2026-11-10')
    expect(s.onestopMunicipalities).toBe(1)
  })
  it('6自治体でワンストップ上限超過', () => {
    const list = 'ABCDEF'.split('').map((c) => d({ municipality: c + '市' }))
    expect(summarize(list, 2026, 0, '2026-11-10').onestopLimitExceeded).toBe(true)
    expect(summarize(list.slice(0, 5), 2026, 0, '2026-11-10').onestopLimitExceeded).toBe(false)
  })
  it('確定申告方式はワンストップ数に含めない', () => {
    const list = 'ABCDEF'.split('').map((c) => d({ municipality: c + '市', method: 'kakutei' }))
    expect(summarize(list, 2026, 0, '2026-11-10').onestopMunicipalities).toBe(0)
  })
  it('期限までの日数と未送付数', () => {
    const s = summarize([d({}), d({ municipality: 'B市', sent: true })], 2026, 0, '2026-11-10')
    expect(s.daysToDonationEnd).toBe(51); expect(s.daysToOnestopDeadline).toBe(61); expect(s.unsentOnestop).toBe(1)
    expect(s.deadline).toBe('2027-01-10')
  })
  it('対象年外は集計から除外', () => {
    const s = summarize([d({ date: '2025-12-31' })], 2026, 0, '2026-11-10')
    expect(s.totalYen).toBe(0); expect(s.ignoredCount).toBe(1)
  })
})

describe('入力検証', () => {
  it('日付', () => { expect(isValidDate('2026-02-30')).toBe(false); expect(isValidDate('2026-02-28')).toBe(true) })
  it('不正値', () => {
    expect(validateDonation({ date: 'x', municipality: ' ', amountYen: -1 })).toHaveLength(3)
    expect(validateDonation({ date: '2026-01-01', municipality: 'A', amountYen: 1.5 })).toHaveLength(1)
  })
})
