import './style.css'
import { simulate, validateInput, type SimulatorInput } from './calc'
import { SOURCE_NOTE, AS_OF } from './thresholds'
import { loadInput, saveInput, inputToJsonBlob, parseInputFromJsonText } from './storage'
import { buildResultsCsvBlob, csvDownloadFileName } from './csv'

const DEFAULT_INPUT: SimulatorInput = {
  hourlyWageYen: 1200,
  hoursPerWeek: 20,
  weeksPerMonth: 4.345,
  otherAnnualIncomeYen: 0,
}

const app = document.getElementById('app')
if (!app) {
  throw new Error('#app 要素が見つかりません')
}

app.innerHTML = `
  <h1>年収の壁シミュレーター</h1>
  <p class="subtitle">時給と労働時間から、税金・社会保険の「年収の壁」までの余裕を試算します。</p>
  <div>
    <span class="privacy-badge">登録不要</span>
    <span class="privacy-badge">入力データは外部送信されません</span>
    <span class="privacy-badge">オフラインでも利用可能</span>
  </div>
  <form id="sim-form" novalidate>
    <div class="field">
      <label for="hourlyWageYen">時給（円）</label>
      <input type="number" id="hourlyWageYen" name="hourlyWageYen" min="0" step="1" required />
    </div>
    <div class="field">
      <label for="hoursPerWeek">1週間の労働時間</label>
      <input type="number" id="hoursPerWeek" name="hoursPerWeek" min="0" max="168" step="0.5" required />
    </div>
    <div class="field">
      <label for="weeksPerMonth">1ヶ月あたりの週数（目安: 4.345）</label>
      <input type="number" id="weeksPerMonth" name="weeksPerMonth" min="0.1" step="0.001" required />
    </div>
    <div class="field">
      <label for="otherAnnualIncomeYen">その他の年間収入（円・副業など、0でも可）</label>
      <input type="number" id="otherAnnualIncomeYen" name="otherAnnualIncomeYen" min="0" step="1" required />
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
    <p id="annual-income"></p>
    <table>
      <thead>
        <tr>
          <th>壁</th>
          <th>金額</th>
          <th>区分</th>
          <th>状態</th>
          <th>週あたり上限の目安</th>
        </tr>
      </thead>
      <tbody id="result-body"></tbody>
    </table>
  </div>
  <div class="disclaimer">
    <strong>免責事項:</strong>
    本ツールは一般的な試算を簡易に行うものであり、税務・社会保険・法律上の助言に代わるものではありません。
    実際の判定は勤務先の規模・雇用契約・扶養状況・各種控除の適用状況等により異なります。
    ${SOURCE_NOTE}
    重要な判断の前には、国税庁・厚生労働省の最新の公表情報、または税理士・社会保険労務士など専門家にご確認ください。
  </div>
  <footer>入力データはこの端末のブラウザ内にのみ保存されます（サーバーへの送信は行いません）。基準日: ${AS_OF}</footer>
`

const form = document.getElementById('sim-form') as HTMLFormElement
const errorsEl = document.getElementById('errors') as HTMLDivElement
const summaryEl = document.getElementById('summary') as HTMLDivElement
const annualIncomeEl = document.getElementById('annual-income') as HTMLParagraphElement
const resultBody = document.getElementById('result-body') as HTMLTableSectionElement
const exportJsonBtn = document.getElementById('export-json') as HTMLButtonElement
const importJsonBtn = document.getElementById('import-json') as HTMLButtonElement
const importFile = document.getElementById('import-file') as HTMLInputElement
const exportCsvBtn = document.getElementById('export-csv') as HTMLButtonElement

let lastResult: ReturnType<typeof simulate> | null = null

function readFormInput(): SimulatorInput {
  const data = new FormData(form)
  return {
    hourlyWageYen: Number(data.get('hourlyWageYen')),
    hoursPerWeek: Number(data.get('hoursPerWeek')),
    weeksPerMonth: Number(data.get('weeksPerMonth')),
    otherAnnualIncomeYen: Number(data.get('otherAnnualIncomeYen')),
  }
}

function fillForm(input: SimulatorInput): void {
  ;(form.elements.namedItem('hourlyWageYen') as HTMLInputElement).value = String(input.hourlyWageYen)
  ;(form.elements.namedItem('hoursPerWeek') as HTMLInputElement).value = String(input.hoursPerWeek)
  ;(form.elements.namedItem('weeksPerMonth') as HTMLInputElement).value = String(input.weeksPerMonth)
  ;(form.elements.namedItem('otherAnnualIncomeYen') as HTMLInputElement).value = String(
    input.otherAnnualIncomeYen,
  )
}

function formatYen(value: number): string {
  return Math.round(value).toLocaleString('ja-JP') + '円'
}

function renderResult(input: SimulatorInput): void {
  const errors = validateInput(input)
  errorsEl.textContent = errors.join(' ')
  if (errors.length > 0) {
    summaryEl.style.display = 'none'
    lastResult = null
    return
  }

  const result = simulate(input)
  lastResult = result
  annualIncomeEl.textContent = `想定年収: ${formatYen(result.annualIncomeYen)}（月あたり ${formatYen(
    result.monthlyIncomeYen,
  )}）`

  resultBody.innerHTML = result.results
    .map((r) => {
      const statusClass = r.status === 'over' ? 'status-over' : 'status-under'
      const statusText = r.status === 'over' ? '超過' : '未満'
      const maxHours =
        r.maxWeeklyHoursToStayUnder === null ? '-' : `${r.maxWeeklyHoursToStayUnder.toFixed(1)}時間/週`
      return `<tr>
        <td>${r.threshold.label}<br><small>${r.threshold.description}</small></td>
        <td>${formatYen(r.thresholdYen)}</td>
        <td>${r.threshold.category === 'tax' ? '税金' : '社会保険'}</td>
        <td class="${statusClass}">${statusText}</td>
        <td>${maxHours}</td>
      </tr>`
    })
    .join('')

  summaryEl.style.display = 'block'
  saveInput(input)
}

form.addEventListener('submit', (e) => {
  e.preventDefault()
  renderResult(readFormInput())
})

exportJsonBtn.addEventListener('click', () => {
  const input = readFormInput()
  const blob = inputToJsonBlob(input)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'income-wall-simulator-settings.json'
  a.click()
  URL.revokeObjectURL(url)
})

importJsonBtn.addEventListener('click', () => importFile.click())

importFile.addEventListener('change', async () => {
  const file = importFile.files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    const input = parseInputFromJsonText(text)
    fillForm(input)
    renderResult(input)
  } catch (err) {
    errorsEl.textContent = err instanceof Error ? err.message : 'インポートに失敗しました。'
  } finally {
    importFile.value = ''
  }
})

exportCsvBtn.addEventListener('click', () => {
  if (!lastResult) {
    errorsEl.textContent = '先に「試算する」を押して結果を表示してください。'
    return
  }
  const blob = buildResultsCsvBlob(lastResult)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = csvDownloadFileName()
  a.click()
  URL.revokeObjectURL(url)
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
