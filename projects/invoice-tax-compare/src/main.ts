import './style.css'
import {
  compare,
  validateInput,
  SIMPLIFIED_CATEGORIES,
  TAX_YEARS,
  type CompareInput,
  type CompareResult,
} from './calc'
import { SOURCE_NOTE, AS_OF } from './thresholds'
import { loadInput, saveInput, inputToJsonBlob, parseInputFromJsonText } from './storage'
import { buildResultsCsvBlob, csvDownloadFileName } from './csv'

const DEFAULT_INPUT: CompareInput = {
  taxYear: 2026,
  wasExempt: true,
  baseSalesYen: 5_000_000,
  sales10Yen: 5_000_000,
  sales8Yen: 0,
  purchases10Yen: 1_100_000,
  purchases8Yen: 0,
  exemptPurchases10Yen: 0,
  exemptPurchases8Yen: 0,
  exemptCreditPercent: 70,
  simplifiedCategory: 5,
  simplifiedFiled: false,
}

const NUMBER_FIELDS: { name: keyof CompareInput; label: string; step: number }[] = [
  { name: 'baseSalesYen', label: '基準期間の課税売上高（円）', step: 1 },
  { name: 'sales10Yen', label: '課税売上高・標準税率10%（税抜・円）', step: 1 },
  { name: 'sales8Yen', label: '課税売上高・軽減税率8%（税抜・円）', step: 1 },
  { name: 'purchases10Yen', label: '課税仕入・10%（税込・インボイス発行事業者からの仕入・円）', step: 1 },
  { name: 'purchases8Yen', label: '課税仕入・8%（税込・インボイス発行事業者からの仕入・円）', step: 1 },
  { name: 'exemptPurchases10Yen', label: '免税事業者等からの仕入・10%（税込・円）', step: 1 },
  { name: 'exemptPurchases8Yen', label: '免税事業者等からの仕入・8%（税込・円）', step: 1 },
  { name: 'exemptCreditPercent', label: '免税事業者等からの仕入に適用する控除割合（%）', step: 0.1 },
]

const app = document.getElementById('app')
if (!app) {
  throw new Error('#app 要素が見つかりません')
}

app.innerHTML = `
  <h1>インボイス特例 納税額比較</h1>
  <p class="subtitle">2割特例・3割特例・簡易課税・本則課税のうち、消費税の納税額がいちばん少ない方式を比べます（個人事業者向け）。</p>
  <div>
    <span class="privacy-badge">登録不要</span>
    <span class="privacy-badge">入力データは外部送信されません</span>
    <span class="privacy-badge">オフラインでも利用可能</span>
  </div>
  <form id="cmp-form" novalidate>
    <div class="field">
      <label for="taxYear">対象年分</label>
      <select id="taxYear" name="taxYear">
        ${TAX_YEARS.map((y) => `<option value="${y.value}">${y.label}</option>`).join('')}
      </select>
    </div>
    <div class="field check">
      <input type="checkbox" id="wasExempt" name="wasExempt" />
      <label for="wasExempt">免税事業者からインボイス発行事業者になった（2割・3割特例の要件）</label>
    </div>
    ${NUMBER_FIELDS.map(
      (f) => `<div class="field">
      <label for="${f.name}">${f.label}</label>
      <input type="number" id="${f.name}" name="${f.name}" min="0" step="${f.step}" required />
    </div>`,
    ).join('')}
    <div class="field">
      <label for="simplifiedCategory">簡易課税の事業区分（1種類の事業のみの場合）</label>
      <select id="simplifiedCategory" name="simplifiedCategory">
        ${SIMPLIFIED_CATEGORIES.map((c) => `<option value="${c.value}">${c.label}</option>`).join('')}
      </select>
    </div>
    <div class="field check">
      <input type="checkbox" id="simplifiedFiled" name="simplifiedFiled" />
      <label for="simplifiedFiled">簡易課税制度選択届出書を提出済み（または適用できる）</label>
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
    <p id="best-method"></p>
    <div class="table-wrap">
    <table>
      <thead>
        <tr><th>方式</th><th>適用</th><th>国税</th><th>地方消費税</th><th>合計</th></tr>
      </thead>
      <tbody id="result-body"></tbody>
    </table>
    </div>
    <p class="note">合計がマイナスの場合は還付（見込み）です。</p>
  </div>
  <div class="disclaimer">
    <strong>免責事項:</strong>
    本ツールは一般的な試算を簡易に行うものであり、税務上の助言に代わるものではありません。
    課税売上・課税仕入の区分、簡易課税の事業区分（複数事業の場合）、端数処理、少額特例などは実際の申告と異なる場合があります。
    ${SOURCE_NOTE}
    重要な判断の前には、国税庁の最新の公表情報、または税理士にご確認ください。
  </div>
  <footer>入力データはこの端末のブラウザ内にのみ保存されます（サーバーへの送信は行いません）。基準日: ${AS_OF}</footer>
`

const form = document.getElementById('cmp-form') as HTMLFormElement
const errorsEl = document.getElementById('errors') as HTMLDivElement
const summaryEl = document.getElementById('summary') as HTMLDivElement
const bestEl = document.getElementById('best-method') as HTMLParagraphElement
const resultBody = document.getElementById('result-body') as HTMLTableSectionElement
const exportJsonBtn = document.getElementById('export-json') as HTMLButtonElement
const importJsonBtn = document.getElementById('import-json') as HTMLButtonElement
const importFile = document.getElementById('import-file') as HTMLInputElement
const exportCsvBtn = document.getElementById('export-csv') as HTMLButtonElement

let lastResult: CompareResult | null = null

const el = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement

function numOf(name: string): number {
  const raw = (el(name) as HTMLInputElement).value.trim()
  return raw === '' ? NaN : Number(raw)
}

function readFormInput(): CompareInput {
  const input = { taxYear: Number(el('taxYear').value), simplifiedCategory: Number(el('simplifiedCategory').value) } as Record<string, number | boolean>
  for (const f of NUMBER_FIELDS) input[f.name] = numOf(f.name)
  input.wasExempt = (el('wasExempt') as HTMLInputElement).checked
  input.simplifiedFiled = (el('simplifiedFiled') as HTMLInputElement).checked
  return input as unknown as CompareInput
}

function fillForm(input: CompareInput): void {
  el('taxYear').value = String(input.taxYear)
  el('simplifiedCategory').value = String(input.simplifiedCategory)
  ;(el('wasExempt') as HTMLInputElement).checked = input.wasExempt
  ;(el('simplifiedFiled') as HTMLInputElement).checked = input.simplifiedFiled
  for (const f of NUMBER_FIELDS) el(f.name).value = String(input[f.name])
}

function formatYen(value: number): string {
  return Math.round(value).toLocaleString('ja-JP') + '円'
}

function renderResult(input: CompareInput): void {
  const errors = validateInput(input)
  errorsEl.textContent = errors.join(' ')
  if (errors.length > 0) {
    summaryEl.style.display = 'none'
    lastResult = null
    return
  }
  const result = compare(input)
  lastResult = result
  const best = result.methods.find((m) => m.id === result.bestId)!
  bestEl.textContent = `最も納税額が少ない方式: ${best.label}（${best.totalYen < 0 ? '還付見込み ' : '合計 '}${formatYen(Math.abs(best.totalYen))}）`
  resultBody.innerHTML = result.methods
    .map((m) => {
      const cls = m.id === result.bestId ? 'best' : m.eligible ? '' : 'ng'
      const sign = m.isRefund ? '-' : ''
      const apply = m.eligible ? '可' : `不可<br><small>${m.reason}</small>`
      return `<tr class="${cls}"><td>${m.label}</td><td>${apply}</td><td>${sign}${formatYen(m.nationalYen)}</td><td>${sign}${formatYen(m.localYen)}</td><td>${formatYen(m.totalYen)}</td></tr>`
    })
    .join('')
  summaryEl.style.display = 'block'
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

exportJsonBtn.addEventListener('click', () => {
  download(inputToJsonBlob(readFormInput()), 'invoice-tax-compare-settings.json')
})

importJsonBtn.addEventListener('click', () => importFile.click())

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

exportCsvBtn.addEventListener('click', () => {
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
