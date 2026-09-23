import { THRESHOLDS, type Threshold } from './thresholds'

export interface SimulatorInput {
  hourlyWageYen: number
  hoursPerWeek: number
  weeksPerMonth: number
  otherAnnualIncomeYen: number
}

export interface ThresholdResult {
  threshold: Threshold
  thresholdYen: number
  status: 'over' | 'under'
  diffYen: number
  maxWeeklyHoursToStayUnder: number | null
}

export interface SimulationResult {
  annualIncomeYen: number
  monthlyIncomeYen: number
  results: ThresholdResult[]
}

export function validateInput(input: SimulatorInput): string[] {
  const errors: string[] = []
  if (!Number.isFinite(input.hourlyWageYen) || input.hourlyWageYen <= 0) {
    errors.push('時給は0より大きい数値で入力してください。')
  }
  if (!Number.isFinite(input.hoursPerWeek) || input.hoursPerWeek < 0) {
    errors.push('週の労働時間は0以上の数値で入力してください。')
  }
  if (!Number.isFinite(input.weeksPerMonth) || input.weeksPerMonth <= 0) {
    errors.push('月あたりの週数は0より大きい数値で入力してください。')
  }
  if (!Number.isFinite(input.otherAnnualIncomeYen) || input.otherAnnualIncomeYen < 0) {
    errors.push('その他の年収は0以上の数値で入力してください。')
  }
  if (input.hoursPerWeek > 168) {
    errors.push('週の労働時間が168時間（1週間の総時間）を超えています。')
  }
  return errors
}

export function simulate(input: SimulatorInput): SimulationResult {
  const annualHours = input.hoursPerWeek * input.weeksPerMonth * 12
  const annualWageIncome = input.hourlyWageYen * annualHours
  const annualIncomeYen = annualWageIncome + input.otherAnnualIncomeYen
  const monthlyIncomeYen = annualIncomeYen / 12

  const annualHourlyCapacity = input.hourlyWageYen * input.weeksPerMonth * 12

  const results: ThresholdResult[] = THRESHOLDS.map((threshold) => {
    const thresholdYen = threshold.manYen * 10000
    const diffYen = thresholdYen - annualIncomeYen
    const status: 'over' | 'under' = diffYen < 0 ? 'over' : 'under'

    let maxWeeklyHoursToStayUnder: number | null = null
    if (annualHourlyCapacity > 0) {
      const maxAnnualWageBudget = thresholdYen - input.otherAnnualIncomeYen
      if (maxAnnualWageBudget > 0) {
        const maxAnnualHours = maxAnnualWageBudget / input.hourlyWageYen
        maxWeeklyHoursToStayUnder = maxAnnualHours / (input.weeksPerMonth * 12)
      } else {
        maxWeeklyHoursToStayUnder = 0
      }
    }

    return { threshold, thresholdYen, status, diffYen, maxWeeklyHoursToStayUnder }
  })

  return { annualIncomeYen, monthlyIncomeYen, results }
}
