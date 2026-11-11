// NISA制度の上限額（目安）。制度改正で変わり得るため、公開前に金融庁の最新情報で必ず確認すること。
export const AS_OF = '2026年11月11日'
export const SOURCE_NOTE =
  '制度の数値（年間投資枠・非課税保有限度額・こどもNISA等）は金融庁の公表資料・報道に基づく目安で、2026年11月時点の整理です。最新・正確な内容は金融庁の公式ページでご確認ください。'

export type AccountType = 'adult' | 'child'

export interface AccountRules {
  label: string
  annualTsumitateYen: number
  annualGrowthYen: number
  totalCapYen: number
  growthCapYen: number
}

export const RULES: Record<AccountType, AccountRules> = {
  adult: {
    label: '成人NISA（18歳以上）',
    annualTsumitateYen: 1_200_000,
    annualGrowthYen: 2_400_000,
    totalCapYen: 18_000_000,
    growthCapYen: 12_000_000,
  },
  child: {
    label: 'こどもNISA（18歳未満・2027年1月開始予定）',
    annualTsumitateYen: 600_000,
    annualGrowthYen: 0,
    totalCapYen: 6_000_000,
    growthCapYen: 0,
  },
}

// 課税口座で売却益・配当に課される税率（所得税15.315%＋住民税5%）
export const TAXABLE_RATE = 0.20315
