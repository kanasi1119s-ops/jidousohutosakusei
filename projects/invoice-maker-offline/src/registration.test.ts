import { describe, expect, it } from 'vitest'
import { checkRegistrationNumber, corporateNumberCheckDigitMatches, normalizeRegistration } from './registration'

describe('登録番号', () => {
  it('全角・ハイフン・空白・小文字を正規化する', () => {
    expect(normalizeRegistration('ｔ７０００-０１２０５ ０００２')).toBe('T7000012050002')
  })
  it('国税庁の法人番号 7000012050002 はチェックディジットが一致する', () => {
    expect(corporateNumberCheckDigitMatches('7000012050002')).toBe(true)
    expect(corporateNumberCheckDigitMatches('1000012050002')).toBe(false)
  })
  it('T+13桁なら形式OK', () => {
    const r = checkRegistrationNumber('T7000012050002')
    expect(r.valid).toBe(true)
    expect(r.corporateCheck).toBe('match')
  })
  it('チェックディジット不一致でも形式OK（個人事業主の可能性）', () => {
    const r = checkRegistrationNumber('T1234567890123')
    expect(r.valid).toBe(true)
    expect(r.corporateCheck).toBe('mismatch')
  })
  it('形式不正・未入力は無効', () => {
    expect(checkRegistrationNumber('').valid).toBe(false)
    expect(checkRegistrationNumber('T123').valid).toBe(false)
    expect(checkRegistrationNumber('1234567890123').valid).toBe(false)
  })
})
