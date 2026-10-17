import './style.css'
import {
  parseYenText,
  referenceTable,
  simulate,
  validateInput,
  type SimulationResult,
  type SimulatorInput,
} from './calc'
import { loadInput, saveInput, inputToJsonBlob, parseInputFromJsonText } from './storage'
import { buildResultsCsvBlob, csvDownloadFileName } from './csv'

const AS_OF = '2026-10-17'

const DEFAULT_INPUT: SimulatorInput = {
  salaryYen: 5_000_000,
  socialInsuranceYen: null,
  extraDeductionYen: 0,
  donatedYen: 0,
}

const app = document.getElementById('app')
if (!app) {
  throw new Error('#app 要素が見つかりません')
}

function formatYen(value: number): string {
  return Math.round(value).toLocaleString('ja-JP') + '円'
}

const refRows = referenceTable()
  .map((r) => `<tr><td>${r.salaryYen / 10_000}万円</td><td>${formatYen(r.limitYen)}</td></tr>`)
  .join('')

app.innerHTML = `
  <h1>ふるさと納税 上限額シミュレーター</h1>
  <p class="subtitle">給与収入から、自己負担2,000円で寄附できる上限額の目安を試算します。</p>
  <div>
    <span class="privacy-badge">登録不要</span>
    <span class="privacy-badge">入力データは外部送信されません</span>
    <span class="privacy-badge">オフラインでも利用可能</span>
  </div>
  <form id="sim-form" novalidate>
    <div class="field">
      <label for="salaryYen">給与収入（額面・年額、円）</label>
      <input type="text" inputmode="numeric" id="salaryYen" name="salaryYen" autocomplete="off" />
    </div>
    <div class="field">
      <label for="socialInsuranceYen">社会保険料の年額（円・空欄なら給与収入の15%で自動概算）</label>
      <input type="text" inputmode="numeric" id="socialInsuranceYen" name="socialInsuranceYen" autocomplete="off" />
    </div>
    <div class="field">
      <label for="extraDeductionYen">基礎控除以外の所得控除の合計（円・配偶者/扶養/生命保険料/iDeCoなど、なければ0）</label>
      <input type="text" inputmode="numeric" id="extraDeductionYen" name="extraDeductionYen" autocomplete="off" />
    </div>
    <div class="field">
      <label for="donatedYen">今年すでに寄附した金額（円、なければ0）</label>
      <input type="text" inputmode="numeric" id="donatedYen" name="donatedYen" autocomplete="off" />
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
    <p id="limit-main" class="status-under"></p>
    <table>
      <tbody id="result-body"></tbody>
    </table>
  </div>
  <div class="summary">
    <h2>年収別の目安（単身・追加控除なし）</h2>
    <table>
      <thead><tr><th>給与収入</th><th>上限額の目安</th></tr></thead>
      <tbody>${refRows}</tbody>
    </table>
  </div>
  <div class="disclaimer">
    <strong>免責事項:</strong>
    本ツールは給与所得者を想定した簡易モデルによる一般的な試算であり、税務上の助言に代わるものではありません。
    住宅ローン控除・医療費控除・副業所得・自営業・年金受給者などは考慮していません。実際の上限額は住民税の課税内容により異なります。
    令和7年度税制改正後の給与所得控除・基礎控除の水準に基づく目安です（基準日: ${AS_OF}）。
    正確な金額は、お住まいの自治体の住民税決定通知書、総務省・国税庁の公表情報、または税理士にご確認ください。
    寄附は年内（12月31日まで）の決済が対象です。確定申告をする方・ワンストップ特例の方とも、手続きの期限にご注意ください。
  </div>
  <footer>入力データはこの端末のブラウザ内にのみ保存されます（サーバーへの送信は行いません）。</footer>
`

const form = document.getElementById('sim-form') as HTMLFormElement
const errorsEl = document.getElementById('errors') as HTMLDivElement
const summaryEl = document.getElementById('summary') as HTMLDivElement
const limitMainEl = document.getElementById('limit-main') as HTMLParagraphElement
const resultBody = document.getElementById('result-body') as HTMLTableSectionElement
const importFile = document.getElementById('import-file') as HTMLInputElement

let lastResult: SimulationResult | null = null
let lastDonated = 0

function field(name: string): HTMLInputElement {
  return form.elements.namedItem(name) as HTMLInputElement
}

function readFormInput(): SimulatorInput {
  const sociRaw = field('socialInsuranceYen').value.trim()
  const orZero = (name: string) => {
    const v = field(name).value.trim()
    return v === '' ? 0 : parseYenText(v)
  }
  return {
    salaryYen: parseYenText(field('salaryYen').value),
    socialInsuranceYen: sociRaw === '' ? null : parseYenText(sociRaw),
    extraDeductionYen: orZero('extraDeductionYen'),
    donatedYen: orZero('donatedYen'),
  }
}

function fillForm(input: SimulatorInput): void {
  field('salaryYen').value = String(input.salaryYen)
  field('socialInsuranceYen').value = input.socialInsuranceYen === null ? '' : String(input.socialInsuranceYen)
  field('extraDeductionYen').value = String(input.extraDeductionYen)
  field('donatedYen').value = String(input.donatedYen)
}

function renderResult(input: SimulatorInput): void {
  const errors = validateInput(input)
  errorsEl.textContent = errors.join(' ')
  if (errors.length > 0) {
    summaryEl.classList.add('hidden')
    lastResult = null
    return
  }
  const r = simulate(input)
  lastResult = r
  lastDonated = input.donatedYen
  limitMainEl.textContent = `控除上限額の目安: ${formatYen(r.limitYen)}（余裕を見るなら ${formatYen(r.safeLimitYen)} 程度）`
  const rows: [string, string][] = [
    ['給与所得（給与収入 − 給与所得控除）', formatYen(r.employmentIncomeYen)],
    ['社会保険料（概算含む）', formatYen(r.socialInsuranceYen)],
    ['所得税の課税所得 / 税率', `${formatYen(r.incomeTaxTaxableYen)} / ${Math.round(r.incomeTaxRate * 100)}%`],
    ['住民税の課税所得', formatYen(r.residentTaxTaxableYen)],
    ['住民税所得割額（概算）', formatYen(r.residentTaxIncomePortionYen)],
    ['寄附済み額', formatYen(input.donatedYen)],
    ['残り寄附可能額の目安', formatYen(r.remainingYen)],
    ['自己負担額', formatYen(r.selfBurdenYen)],
  ]
  resultBody.innerHTML = rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')
  summaryEl.classList.remove('hidden')
  saveInput(input)
}

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

form.addEventListener('submit', (e) => {
  e.preventDefault()
  renderResult(readFormInput())
})

document.getElementById('export-json')!.addEventListener('click', () => {
  const input = readFormInput()
  const errors = validateInput(input)
  if (errors.length > 0) {
    errorsEl.textContent = errors.join(' ')
    return
  }
  download(inputToJsonBlob(input), 'furusato-limit-settings.json')
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
  if (!lastResult) {
    errorsEl.textContent = '先に「試算する」を押して結果を表示してください。'
    return
  }
  download(buildResultsCsvBlob(lastResult, lastDonated), csvDownloadFileName())
})

const saved = loadInput() ?? DEFAULT_INPUT
fillForm(saved)
renderResult(saved)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // 登録に失敗しても通常利用は継続できる
    })
  })
}
