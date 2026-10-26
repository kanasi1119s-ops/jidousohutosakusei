import './style.css'
import { parseYen, simulate, validateInput, type SimulationResult, type SimulatorInput } from './calc'
import {
  AS_OF,
  BUSINESS_TYPE_LABELS,
  DEFAULT_TRANSITIONAL_RATIO,
  SOURCE_NOTE,
  SPECIAL_LABEL,
  TAX_YEARS,
  TRANSITIONAL_RATIOS,
  TRANSITIONAL_SCHEDULE_NOTE,
  type TaxYear,
} from './thresholds'
import { inputToJsonBlob, loadInput, parseInputFromJsonText, saveInput } from './storage'
import { buildResultsCsvBlob, csvDownloadFileName } from './csv'

const DEFAULT_INPUT: SimulatorInput = {
  taxYear: 2027,
  baseSalesYen: 6_000_000,
  registered: true,
  sales10Yen: 8_000_000,
  sales8Yen: 0,
  purchases10Yen: 2_000_000,
  purchases8Yen: 0,
  exemptPurchasesYen: 0,
  transitionalRatio: DEFAULT_TRANSITIONAL_RATIO[2027],
  businessType: 5,
}

const MONEY_FIELDS: Array<{ name: keyof SimulatorInput; label: string; hint?: string }> = [
  { name: 'baseSalesYen', label: '基準期間（前々年）の課税売上高（税抜・円）', hint: '特例・簡易課税の適用判定に使います' },
  { name: 'sales10Yen', label: '課税売上高（税込・標準税率10%・円）' },
  { name: 'sales8Yen', label: '課税売上高（税込・軽減税率8%・円）' },
  { name: 'purchases10Yen', label: '課税仕入高（税込・10%・円）', hint: '原則課税で控除できる実額（登録事業者からの仕入・経費）' },
  { name: 'purchases8Yen', label: '課税仕入高（税込・軽減8%・円）' },
  { name: 'exemptPurchasesYen', label: '免税事業者等からの課税仕入高（税込・10%・円）', hint: 'インボイスのない仕入。経過措置の割合のみ控除' },
]

const app = document.getElementById('app')
if (!app) throw new Error('#app 要素が見つかりません')

const yearOptions = TAX_YEARS.map((y) => `<option value="${y}">${y}年分（${SPECIAL_LABEL[y]}）</option>`).join('')
const typeOptions = Object.entries(BUSINESS_TYPE_LABELS)
  .map(([k, v]) => `<option value="${k}">${v}</option>`)
  .join('')
const ratioOptions = TRANSITIONAL_RATIOS.map((r) => `<option value="${r}">${r}%</option>`).join('')
const moneyHtml = MONEY_FIELDS.map(
  (f) => `
    <div class="field">
      <label for="${f.name}">${f.label}</label>
      <input type="text" inputmode="numeric" autocomplete="off" id="${f.name}" name="${f.name}" />
      ${f.hint ? `<small class="hint">${f.hint}</small>` : ''}
    </div>`,
).join('')

app.innerHTML = `
  <h1>消費税 納税額シミュレーター</h1>
  <p class="subtitle">2割特例の終了後、個人事業者の「3割特例・簡易課税・原則課税」で納税額がいくら変わるかを比較します。</p>
  <div>
    <span class="privacy-badge">登録不要</span>
    <span class="privacy-badge">入力データは外部送信されません</span>
    <span class="privacy-badge">オフラインでも利用可能</span>
  </div>
  <form id="sim-form" novalidate>
    <div class="field">
      <label for="taxYear">対象年分（個人事業者・暦年）</label>
      <select id="taxYear" name="taxYear">${yearOptions}</select>
    </div>
    <div class="field check">
      <input type="checkbox" id="registered" name="registered" />
      <label for="registered">インボイス発行事業者の登録をしている（または登録予定）</label>
    </div>
    ${moneyHtml}
    <div class="field">
      <label for="businessType">簡易課税の事業区分（単一の事業のみ）</label>
      <select id="businessType" name="businessType">${typeOptions}</select>
    </div>
    <div class="field">
      <label for="transitionalRatio">免税事業者等からの仕入の控除割合（経過措置）</label>
      <select id="transitionalRatio" name="transitionalRatio">${ratioOptions}</select>
      <small class="hint">${TRANSITIONAL_SCHEDULE_NOTE}</small>
    </div>
    <div class="errors" id="errors" role="alert"></div>
    <div class="actions">
      <button type="submit">試算する</button>
      <button type="button" class="secondary" id="export-json">設定をエクスポート(JSON)</button>
      <button type="button" class="secondary" id="import-json">設定をインポート(JSON)</button>
      <input type="file" id="import-file" accept="application/json" class="hidden" />
      <button type="button" class="secondary" id="export-csv">結果をCSVでダウンロード</button>
    </div>
  </form>
  <div class="summary hidden" id="summary">
    <h2>試算結果</h2>
    <p id="tax-summary"></p>
    <p id="best-summary" class="best"></p>
    <table>
      <thead>
        <tr><th>方式</th><th>納付税額の目安</th><th>内訳（国税／地方）</th><th>備考</th></tr>
      </thead>
      <tbody id="result-body"></tbody>
    </table>
  </div>
  <div class="disclaimer">
    <strong>免責事項:</strong>
    本ツールは一般的な試算を簡易に行うものであり、税務上の助言に代わるものではありません。
    実際の納税額は、売上・仕入の区分、端数処理、中間納付、他の課税期間の状況等により異なります。
    ${SOURCE_NOTE}
    重要な判断の前には、国税庁の最新の公表情報、または税理士にご確認ください。
  </div>
  <footer>入力データはこの端末のブラウザ内にのみ保存されます（サーバーへの送信は行いません）。基準日: ${AS_OF}</footer>
`

const form = document.getElementById('sim-form') as HTMLFormElement
const errorsEl = document.getElementById('errors') as HTMLDivElement
const summaryEl = document.getElementById('summary') as HTMLDivElement
const taxSummaryEl = document.getElementById('tax-summary') as HTMLParagraphElement
const bestSummaryEl = document.getElementById('best-summary') as HTMLParagraphElement
const resultBody = document.getElementById('result-body') as HTMLTableSectionElement
const importFile = document.getElementById('import-file') as HTMLInputElement
const taxYearEl = form.elements.namedItem('taxYear') as HTMLSelectElement
const ratioEl = form.elements.namedItem('transitionalRatio') as HTMLSelectElement

let lastInput: SimulatorInput | null = null
let lastResult: SimulationResult | null = null

function field(name: string): HTMLInputElement {
  return form.elements.namedItem(name) as HTMLInputElement
}

function readFormInput(): SimulatorInput {
  const num = (name: string) => parseYen(field(name).value)
  return {
    taxYear: Number(taxYearEl.value) as TaxYear,
    baseSalesYen: num('baseSalesYen'),
    registered: field('registered').checked,
    sales10Yen: num('sales10Yen'),
    sales8Yen: num('sales8Yen'),
    purchases10Yen: num('purchases10Yen'),
    purchases8Yen: num('purchases8Yen'),
    exemptPurchasesYen: num('exemptPurchasesYen'),
    transitionalRatio: Number(ratioEl.value),
    businessType: Number((form.elements.namedItem('businessType') as HTMLSelectElement).value),
  }
}

function fillForm(input: SimulatorInput): void {
  taxYearEl.value = String(input.taxYear)
  field('registered').checked = input.registered
  for (const f of MONEY_FIELDS) field(f.name).value = String(input[f.name])
  ;(form.elements.namedItem('businessType') as HTMLSelectElement).value = String(input.businessType)
  ratioEl.value = String(input.transitionalRatio)
}

function formatYen(value: number): string {
  return Math.round(value).toLocaleString('ja-JP') + '円'
}

function cell(text: string, className?: string): HTMLTableCellElement {
  const td = document.createElement('td')
  td.textContent = text
  if (className) td.className = className
  return td
}

function renderResult(input: SimulatorInput): void {
  const errors = validateInput(input)
  errorsEl.textContent = errors.join(' ')
  if (errors.length > 0) {
    summaryEl.style.display = 'none'
    lastResult = null
    lastInput = null
    return
  }

  const result = simulate(input)
  lastResult = result
  lastInput = input
  taxSummaryEl.textContent = `売上税額: ${formatYen(result.salesTaxYen)} ／ 仕入税額（原則課税の控除額）: ${formatYen(result.purchaseTaxYen)}`

  const best = result.methods.find((m) => m.id === result.bestId)
  bestSummaryEl.textContent = best
    ? `この条件で納付税額が最も小さい方式: ${best.label}（${formatYen(best.totalYen)}${best.totalYen < 0 ? '・還付' : ''}）`
    : ''

  resultBody.replaceChildren(
    ...result.methods.map((m) => {
      const tr = document.createElement('tr')
      if (m.id === result.bestId) tr.className = 'best-row'
      if (!m.eligible) tr.className = 'ineligible'
      const amount = m.eligible
        ? formatYen(m.totalYen) + (m.totalYen < 0 ? '（還付）' : '')
        : '適用不可'
      tr.append(
        cell(m.label + (m.id === result.bestId ? ' ★' : '')),
        cell(amount, 'amount'),
        cell(m.eligible && m.totalYen > 0 ? `${formatYen(m.nationalYen)}／${formatYen(m.localYen)}` : '-'),
        cell(m.note, 'note'),
      )
      return tr
    }),
  )

  summaryEl.style.display = 'block'
  saveInput(input)
}

function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

form.addEventListener('submit', (e) => {
  e.preventDefault()
  renderResult(readFormInput())
})

// 年分を変えたら、その年分の標準的な経過措置の割合を初期値として提案する
taxYearEl.addEventListener('change', () => {
  ratioEl.value = String(DEFAULT_TRANSITIONAL_RATIO[Number(taxYearEl.value) as TaxYear])
})

document.getElementById('export-json')!.addEventListener('click', () => {
  const input = readFormInput()
  const errors = validateInput(input)
  if (errors.length > 0) {
    errorsEl.textContent = errors.join(' ')
    return
  }
  download(inputToJsonBlob(input), 'invoice-tax-simulator-settings.json')
})

document.getElementById('import-json')!.addEventListener('click', () => importFile.click())

importFile.addEventListener('change', async () => {
  const file = importFile.files?.[0]
  if (!file) return
  try {
    const input = parseInputFromJsonText(await file.text())
    fillForm(input)
    renderResult(input)
  } catch (err) {
    errorsEl.textContent = err instanceof Error ? err.message : 'インポートに失敗しました。'
  } finally {
    importFile.value = ''
  }
})

document.getElementById('export-csv')!.addEventListener('click', () => {
  if (!lastResult || !lastInput) {
    errorsEl.textContent = '先に「試算する」を押して結果を表示してください。'
    return
  }
  download(buildResultsCsvBlob(lastInput, lastResult), csvDownloadFileName())
})

const savedInput = loadInput() ?? DEFAULT_INPUT
fillForm(savedInput)
renderResult(savedInput)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // オフライン対応の登録に失敗しても、通常利用は継続できる
    })
  })
}
