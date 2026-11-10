import { describe, it, expect } from 'vitest'
import { buildDonationsCsv, parseDonationsCsv, parseCsv, csvFileName } from './csv'
import type { Donation } from './ledger'

const list: Donation[] = [
  { id: '1', date: '2026-11-01', municipality: '北海道 "東川"町', amountYen: 30000, method: 'onestop', sent: true },
  { id: '2', date: '2026-11-02', municipality: 'A,B市', amountYen: 10000, method: 'kakutei', sent: false },
]
describe('CSV', () => {
  it('BOM付きで始まり日本語ヘッダーを含む', () => {
    const t = buildDonationsCsv(list)
    expect(t.charCodeAt(0)).toBe(0xfeff); expect(t).toContain('寄付日')
  })
  it('往復で内容が一致する（引用符・カンマ含む）', () => {
    let n = 0
    const back = parseDonationsCsv(buildDonationsCsv(list), () => String(++n))
    expect(back.map(({ id: _id, ...r }) => r)).toEqual(list.map(({ id: _id, ...r }) => r))
  })
  it('不正なヘッダーはエラー', () => { expect(() => parseDonationsCsv('a,b\r\n1,2', () => 'x')).toThrow('形式が不正') })
  it('不正な行はエラー', () => { expect(() => parseDonationsCsv('寄付日,自治体名,金額(円),申請方法,申請書送付済み\r\n2026-13-01,A,1,確定申告,-', () => 'x')).toThrow('2行目') })
  it('改行入りフィールド', () => { expect(parseCsv('a,"b\nc"\n')).toEqual([['a', 'b\nc']]) })
  it('ファイル名は英数字', () => { expect(csvFileName(new Date(2026, 10, 9))).toBe('furusato-donations-2026-11-09.csv') })
})
