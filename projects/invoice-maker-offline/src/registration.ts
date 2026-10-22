export interface RegistrationCheck {
  valid: boolean
  normalized: string
  message: string
  /** 法人番号のチェックディジットとの整合。個人事業主の番号は検証できないため 'unknown' */
  corporateCheck: 'match' | 'mismatch' | 'none'
}

export function normalizeRegistration(text: string): string {
  return text
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\s\-－−ー‐]/g, '')
    .toUpperCase()
}

/** 法人番号（13桁）のチェックディジットが正しいか。先頭1桁が検査用数字 */
export function corporateNumberCheckDigitMatches(digits13: string): boolean {
  if (!/^\d{13}$/.test(digits13)) return false
  const body = digits13.slice(1)
  let sum = 0
  for (let n = 1; n <= 12; n++) {
    const digit = Number(body[12 - n])
    sum += digit * (n % 2 === 1 ? 1 : 2)
  }
  return 9 - (sum % 9) === Number(digits13[0])
}

export function checkRegistrationNumber(text: string): RegistrationCheck {
  const normalized = normalizeRegistration(text)
  if (normalized === '') {
    return { valid: false, normalized, message: '未入力です', corporateCheck: 'none' }
  }
  if (!/^T\d{13}$/.test(normalized)) {
    return {
      valid: false,
      normalized,
      message: '「T」＋数字13桁の形式で入力してください（例: T1234567890123）',
      corporateCheck: 'none',
    }
  }
  const ok = corporateNumberCheckDigitMatches(normalized.slice(1))
  return {
    valid: true,
    normalized,
    message: ok
      ? '形式OK（法人番号のチェックディジットと整合）'
      : '形式OK（法人番号のチェックディジットとは一致しません。個人事業主の番号なら正常です）',
    corporateCheck: ok ? 'match' : 'mismatch',
  }
}
