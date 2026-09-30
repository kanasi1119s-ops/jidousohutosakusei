import './style.css'
import { simulate, validateInput, parseNumberLoose, type SimulatorInput, type SimulationResult } from './calc'
import { SOURCE_NOTE, AS_OF } from './limits'
import { loadInput, saveInput, inputToJsonBlob, parseInputFromJsonText } from './storage'
import { buildResultsCsvBlob, csvDownloadFileName } from './csv'

const DEFAULT_INPUT: SimulatorInput = {
  initialYen: 0,
  monthlyTsumitateYen: 50000,
  monthlyGrowthYen: 0,
  annualReturnPct: 5,
  years: 20,
}

const app = document.getElementById('app')
if (!app) throw new Error('#app 要素が見つかりません')

app.innerHTML = `
  <h1>新NISA積立シミュレーター</h1>
  <p class="subtitle">毎月の積立額・想定利回り・期間から、投資枠の上限を踏まえた将来の評価額を試算します。</p>
  <div>
    <span class="privacy-badge">登録不要</span>
    <span class="privacy-badge">入力データは外部送信されません</span>
    <span class="privacy-badge">オフラインでも利用可能</span>
  </div>
  <form id="sim-form" novalidate>
    <div class="field"><label for="initialYen">初期投資額（円・1年目の成長投資枠に投入）</label>
      <input type="text" inputmode="decimal" id="initialYen" name="initialYen" /></div>
    <div class="field"><label for="monthlyTsumitateYen">毎月の積立額: つみたて投資枠（円）</label>
      <input type="text" inputmode="decimal" id="monthlyTsumitateYen" name="monthlyTsumitateYen" /></div>
    <div class="field"><label for="monthlyGrowthYen">毎月の積立額: 成長投資枠（円）</label>
      <input type="text" inputmode="decimal" id="monthlyGrowthYen" name="monthlyGrowthYen" /></div>
    <div class="field"><label for="annualReturnPct">想定年利回り（%・将来を保証するものではありません）</label>
      <input type="text" inputmode="decimal" id="annualReturnPct" name="annualReturnPct" /></div>
    <div class="field"><label for="years">積立期間（年）</label>
      <input type="text" inputmode="numeric" id="years" name="years" /></div>
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
    <p id="warnings" class="status-over"></p>
    <p id="totals"></p>
    <table>
      <thead><tr><th>経過年数</th><th>元本</th><th>評価額</th><th>運用益</th></tr></thead>
      <tbody id="result-body"></tbody>
    </table>
  </div>
  <div class="disclaimer">
    <strong>免責事項:</strong>
    本ツールは一定の前提（毎月定額・利回り一定・売却なし・手数料や為替は考慮しない）に基づく一般的な試算であり、
    将来の運用成果を保証するものでも、投資助言・税務助言に代わるものでもありません。投資には元本割れのリスクがあります。
    ${SOURCE_NOTE}
    重要な判断の前には、金融庁の公表情報や金融機関・ファイナンシャルプランナー等の専門家にご確認ください。
  </div>
  <footer>入力データはこの端末のブラウザ内にのみ保存されます（サーバーへの送信は行いません）。基準日: ${AS_OF}</footer>
`

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const form = $<HTMLFormElement>('sim-form')
const errorsEl = $<HTMLDivElement>('errors')
const summaryEl = $<HTMLDivElement>('summary')
const totalsEl = $<HTMLParagraphElement>('totals')
const warningsEl = $<HTMLParagraphElement>('warnings')
const resultBody = $<HTMLTableSectionElement>('result-body')
const importFile = $<HTMLInputElement>('import-file')

let lastResult: SimulationResult | null = null
const FIELDS = ['initialYen', 'monthlyTsumitateYen', 'monthlyGrowthYen', 'annualReturnPct', 'years'] as const

function readFormInput(): SimulatorInput {
  const v = (n: string) => parseNumberLoose((form.elements.namedItem(n) as HTMLInputElement).value)
  return {
    initialYen: v('initialYen'),
    monthlyTsumitateYen: v('monthlyTsumitateYen'),
    monthlyGrowthYen: v('monthlyGrowthYen'),
    annualReturnPct: v('annualReturnPct'),
    years: v('years'),
  }
}

function fillForm(input: SimulatorInput): void {
  for (const k of FIELDS) (form.elements.namedItem(k) as HTMLInputElement).value = String(input[k])
}

const yen = (n: number) => Math.round(n).toLocaleString('ja-JP') + '円'

function renderResult(input: SimulatorInput): void {
  const errors = validateInput(input)
  errorsEl.textContent = errors.join(' ')
  if (errors.length > 0) {
    summaryEl.style.display = 'none'
    lastResult = null
    return
  }
  const r = simulate(input)
  lastResult = r
  warningsEl.textContent = r.warnings.join(' ')
  totalsEl.textContent =
    `最終評価額 ${yen(r.nisaFinalYen)}（元本 ${yen(r.principalYen)} ＋ 運用益 ${yen(r.gainYen)}）。` +
    `同じ運用を課税口座で行い最終年に売却した場合の税引後は約 ${yen(r.taxableFinalYen)}、` +
    `非課税による差は約 ${yen(r.taxSavedYen)} です。`
  resultBody.innerHTML = r.rows
    .map(
      (x) =>
        `<tr><td>${x.year}年目</td><td>${yen(x.principalYen)}</td><td>${yen(x.balanceYen)}</td><td>${yen(x.gainYen)}</td></tr>`,
    )
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
$('export-json').addEventListener('click', () =>
  download(inputToJsonBlob(readFormInput()), 'nisa-tsumitate-simulator-settings.json'),
)
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
    errorsEl.textContent = '先に「試算する」を押して結果を表示してください。'
    return
  }
  download(buildResultsCsvBlob(lastResult), csvDownloadFileName())
})

const saved = loadInput() ?? DEFAULT_INPUT
fillForm(saved)
renderResult(saved)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}
