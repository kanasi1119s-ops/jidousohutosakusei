import { describe, expect, it } from 'vitest'
import { parseAppDataFromJsonText, type AppData } from './storage'
import { DEFAULT_NUMBERING } from './numbering'
import { DEFAULT_PROFILE } from './storage'

const sample: AppData = {
  formatVersion: 1,
  profile: { ...DEFAULT_PROFILE, businessName: 'テスト商店' },
  numbering: DEFAULT_NUMBERING,
  clients: [],
  invoices: [],
}

describe('parseAppDataFromJsonText', () => {
  it('正しい形式のJSONを復元する', () => {
    const parsed = parseAppDataFromJsonText(JSON.stringify(sample))
    expect(parsed.profile.businessName).toBe('テスト商店')
  })

  it('不正なJSON文字列はエラー', () => {
    expect(() => parseAppDataFromJsonText('{not json')).toThrow()
  })

  it('formatVersionが異なる/欠けている場合はエラー', () => {
    expect(() => parseAppDataFromJsonText(JSON.stringify({ ...sample, formatVersion: 2 }))).toThrow()
    const { formatVersion, ...withoutVersion } = sample
    void formatVersion
    expect(() => parseAppDataFromJsonText(JSON.stringify(withoutVersion))).toThrow()
  })

  it('必須フィールドが欠けている場合はエラー', () => {
    const { clients, ...withoutClients } = sample
    void clients
    expect(() => parseAppDataFromJsonText(JSON.stringify(withoutClients))).toThrow()
  })
})
