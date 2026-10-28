import './style.css'
import { parseYen, simulate, validateInput, type SimulatorInput, type SimulationResult } from './calc'
import { AS_OF, BUSINESS_TYPES, SOURCE_NOTE, TAX_YEARS } from './rules'
import { loadInput, saveInput, inputToJsonBlob, parseInputFromJsonText } from './storage'
import { buildResultsCsvBlob, csvDownloadFileName } from './csv'

const DEFAULT_INPUT: SimulatorInput = {
  year: 2027,
  salesStandardYen: 5_500_000,
  salesReducedYen: 0,
  purchasesStandardYen: 1_100_000,
  purchasesReducedYen: 0,
  businessType: 5,
  registeredToBecomeTaxable: true,
  baseSalesYen: 0,
}

const MONEY_FIELDS = [
  ['salesStandardYen', '課税売上・標準税率10%（税込・円）'],
  ['salesReducedYen', '課税売上・軽減税率8%（税込・円。なければ0）'],
  ['purchasesStandardYen', '課税仕入・標準税率10%（税込・円。適格請求書等があるもの）'],
  ['purchasesReducedYen', '課税仕入・軽減税率8%（税込・円。なければ0）'],
  ['baseSalesYen', '基準期間（2年前）の課税売上高（税抜・円。不明・新規なら0）'],
] as const

const app = document.getElementById('app')
if (!app) {
  throw new Error('#app 要素が見つかりません')
}

app.innerHTML = `
  <h1>消費税 特例比較シミュレーター</h1>
  <p class="subtitle">インボイス登録した個人事業者向け。2割特例・3割特例・簡易課税・本則課税の納付税額を比べます。</p>
  <div>
    <span class="privacy-badge">登録不要</span>
    <span class="privacy-badge">入力データは外部送信されません</span>
    <span class="privacy-badge">オフラインでも利用可能</span>
  </div>
  <form id="sim-form" novalidate>
    <div class="field">
      <label for="year">対象年（暦年）</label>
      <select id="year" name="year">
        ${TAX_YEARS.map((y) => `<option value="${y}">${y}年分</option>`).join('')}
      </select>
    </div>
    ${MONEY_FIELDS.map(
      ([key, label]) => `<div class="field">
      <label for="${key}">${label}</label>
      <input type="text" inputmode="numeric" autocomplete="off" id="${key}" name="${key}" />
    </div>`,
    ).join('')}
    <div class="field">
      <label for="businessType">事業区分（簡易課税のみ使用）</label>
      <select id="businessType" name="businessType">
        ${BUSINESS_TYPES.map((b) => `<option value="${b.id}">${b.label}：みなし仕入率${b.deemedRate}%</option>`).join('')}
      </select>
    </div>
    <div class="field check">
      <input type="checkbox" id="registeredToBecomeTaxable" name="registeredToBecomeTaxable" />
      <label for="registeredToBecomeTaxable">インボイス登録を機に、免税事業者から課税事業者になった</label>
    </div>
    <div class="errors" id="errors" role="alert"></div>
    <div class="actions">
      <button type="submit">比較する</button>
      <button type="button" class="secondary" id="export-json">設定をエクスポート(JSON)</button>
      <button type="button" class="secondary" id="import-json">設定をインポート(JSON)</button>
      <input type="file" id="import-file" accept="application/json" class="hidden" />
      <button type="button" class="secondary" id="export-csv">結果をCSVでダウンロード</button>
    </div>
  </form>
  <div class="summary hidden" id="summary">
    <h2>比較結果</h2>
    <p class="headline" id="headline"></p>
    <table>
      <thead>
        <tr><th>方式</th><th>売上税額</th><th>控除</th><th>納付税額</th></tr>
      </thead>
      <tbody id="result-body"></tbody>
    </table>
    <ul id="notes"></ul>
  </div>
  <div class="disclaimer">
    <strong>免責事項:</strong>
    本ツールは一般的な試算を簡易に行うものであり、税務上の助言に代わるものではありません。
    売上税額・仕入税額は税込額から割り戻した国税と地方消費税の合計の概算で、1円未満は切り捨てています。
    事業区分の判定、インボイスのない仕入の経過措置、事業の混在、前年からの届出状況などは反映していません。
    ${SOURCE_NOTE}
    申告・届出の前には、国税庁の最新の公表情報、または税理士にご確認ください。
  </div>
  <footer>入力データはこの端末のブラウザ内にのみ保存されます（サーバーへの送信は行いません）。基準日: ${AS_OF}</footer>
`

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const form = $<HTMLFormElement>('sim-form')
const errorsEl = $<HTMLDivElement>('errors')
const summaryEl = $<HTMLDivElement>('summary')
const headlineEl = $<HTMLParagraphElement>('headline')
const resultBody = $<HTMLTableSectionElement>('result-body')
const notesEl = $<HTMLUListElement>('notes')
const importFile = $<HTMLInputElement>('import-file')

let lastResult: SimulationResult | null = null

const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement

function readFormInput(): SimulatorInput {
  const v = (name: string) => parseYen(field(name).value)
  return {
    year: Number(field('year').value) as SimulatorInput['year'],
    salesStandardYen: v('salesStandardYen'),
    salesReducedYen: v('salesReducedYen'),
    purchasesStandardYen: v('purchasesStandardYen'),
    purchasesReducedYen: v('purchasesReducedYen'),
    businessType: Number(field('businessType').value) as SimulatorInput['businessType'],
    registeredToBecomeTaxable: (field('registeredToBecomeTaxable') as HTMLInputElement).checked,
    baseSalesYen: v('baseSalesYen'),
  }
}

function fillForm(input: SimulatorInput): void {
  field('year').value = String(input.year)
  field('businessType').value = String(input.businessType)
  ;(field('registeredToBecomeTaxable') as HTMLInputElement).checked = input.registeredToBecomeTaxable
  for (const [key] of MONEY_FIELDS) field(key).value = String(input[key])
}

function formatYen(value: number): string {
  return value.toLocaleString('ja-JP') + '円'
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
  const best = result.methods.find((m) => m.id === result.bestId)!
  headlineEl.textContent =
    result.savingVsStandardYen > 0
      ? `利用できる方式では「${best.label}」が最も低く、本則課税より ${formatYen(result.savingVsStandardYen)} 少なくなる試算です。`
      : `利用できる方式では「${best.label}」が最も低い（本則課税と同額）試算です。`

  resultBody.replaceChildren()
  notesEl.replaceChildren()
  for (const m of result.methods) {
    const tr = document.createElement('tr')
    if (m.id === result.bestId) tr.className = 'best-row'
    const cells = [
      m.label + (m.available ? '' : '（利用不可・参考値）'),
      formatYen(m.salesTaxYen),
      formatYen(m.deductionYen),
      formatYen(m.payableYen) + (m.payableYen < 0 ? '（還付）' : ''),
    ]
    cells.forEach((text, i) => {
      const td = document.createElement('td')
      td.textContent = text
      if (!m.available && i === 0) td.className = 'na'
      tr.appendChild(td)
    })
    resultBody.appendChild(tr)
    if (m.note) {
      const li = document.createElement('li')
      li.textContent = `${m.label}: ${m.note}`
      notesEl.appendChild(li)
    }
  }
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

$('export-json').addEventListener('click', () => {
  const input = readFormInput()
  const errors = validateInput(input)
  if (errors.length > 0) {
    errorsEl.textContent = errors.join(' ')
    return
  }
  download(inputToJsonBlob(input), 'consumption-tax-simulator-settings.json')
})

$('import-json').addEventListener('click', () => importFile.click())

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

$('export-csv').addEventListener('click', () => {
  if (!lastResult) {
    errorsEl.textContent = '先に「比較する」を押して結果を表示してください。'
    return
  }
  download(buildResultsCsvBlob(lastResult), csvDownloadFileName())
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
