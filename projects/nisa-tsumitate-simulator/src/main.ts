import './style.css'
import { simulate, validateInput, type SimInput, type SimResult } from './calc'
import { AS_OF, RULES, SOURCE_NOTE } from './rules'
import { loadInput, saveInput, inputToJsonBlob, parseInputFromJsonText } from './storage'
import { buildCsvBlob, csvFileName } from './csv'

const DEFAULT_INPUT: SimInput = {
  account: 'adult',
  initialYen: 0,
  monthlyTsumitateYen: 30000,
  monthlyGrowthYen: 0,
  annualReturnPct: 3,
  years: 20,
}

const app = document.getElementById('app')!
app.innerHTML = `
  <h1>NISA積立シミュレーター</h1>
  <p class="subtitle">毎月の積立額・想定利回り・期間から、将来の資産額と非課税枠の使用状況を試算します。</p>
  <div>
    <span class="privacy-badge">登録不要</span>
    <span class="privacy-badge">入力データは外部送信されません</span>
    <span class="privacy-badge">オフラインでも利用可能</span>
  </div>
  <form id="sim-form" novalidate>
    <div class="field">
      <label for="account">対象口座</label>
      <select id="account" name="account">
        <option value="adult">${RULES.adult.label}</option>
        <option value="child">${RULES.child.label}</option>
      </select>
    </div>
    <div class="field"><label for="initialYen">開始時の一括投資（円）</label>
      <input type="number" id="initialYen" name="initialYen" min="0" step="1" required /></div>
    <div class="field"><label for="monthlyTsumitateYen">毎月の積立額・つみたて投資枠（円）</label>
      <input type="number" id="monthlyTsumitateYen" name="monthlyTsumitateYen" min="0" step="1" required /></div>
    <div class="field"><label for="monthlyGrowthYen">毎月の積立額・成長投資枠（円）</label>
      <input type="number" id="monthlyGrowthYen" name="monthlyGrowthYen" min="0" step="1" required /></div>
    <div class="field"><label for="annualReturnPct">想定年利回り（%・将来を保証するものではありません）</label>
      <input type="number" id="annualReturnPct" name="annualReturnPct" min="-50" max="30" step="0.1" required /></div>
    <div class="field"><label for="years">積立期間（年）</label>
      <input type="number" id="years" name="years" min="1" max="60" step="1" required /></div>
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
    <p id="final-value" class="big"></p>
    <ul id="highlights"></ul>
    <div class="bar" aria-hidden="true"><div id="cap-bar"></div></div>
    <p id="cap-note" class="note"></p>
    <div id="chart" role="img" aria-label="元本と評価額の推移グラフ"></div>
    <table>
      <thead><tr><th>年</th><th>元本</th><th>評価額</th><th>運用益</th></tr></thead>
      <tbody id="result-body"></tbody>
    </table>
  </div>
  <div class="disclaimer">
    <strong>免責事項:</strong>
    本ツールは一定の仮定（毎月一定利回りで複利運用、手数料・信託報酬・為替・インフレは考慮しない、枠の再利用は考慮しない、
    総枠到達後の積立は行わない、課税口座の税率は20.315%）に基づく簡易試算であり、運用成果や将来の資産額を保証するものでも、
    投資助言・税務助言でもありません。投資には元本割れのリスクがあります。${SOURCE_NOTE}
    投資判断は、金融機関・ファイナンシャルプランナー等の専門家にもご相談のうえ、ご自身の責任で行ってください。
  </div>
  <footer>入力データはこの端末のブラウザ内にのみ保存されます（サーバーへの送信は行いません）。基準日: ${AS_OF}</footer>
`

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const form = $<HTMLFormElement>('sim-form')
const errorsEl = $<HTMLDivElement>('errors')
const summaryEl = $<HTMLDivElement>('summary')
const importFile = $<HTMLInputElement>('import-file')
let last: SimResult | null = null

const yen = (v: number) => Math.round(v).toLocaleString('ja-JP') + '円'
const field = (n: string) => form.elements.namedItem(n) as HTMLInputElement

function readForm(): SimInput {
  const d = new FormData(form)
  const num = (k: string) => (String(d.get(k)).trim() === '' ? NaN : Number(d.get(k)))
  return {
    account: d.get('account') === 'child' ? 'child' : 'adult',
    initialYen: num('initialYen'),
    monthlyTsumitateYen: num('monthlyTsumitateYen'),
    monthlyGrowthYen: num('monthlyGrowthYen'),
    annualReturnPct: num('annualReturnPct'),
    years: num('years'),
  }
}

function fillForm(i: SimInput): void {
  for (const [k, v] of Object.entries(i)) field(k).value = String(v)
}

function chartSvg(res: SimResult): string {
  const W = 600, H = 220, P = 8
  const max = Math.max(...res.rows.map((r) => Math.max(r.valueYen, r.principalYen)), 1)
  const n = res.rows.length
  const x = (idx: number) => P + (n === 1 ? (W - 2 * P) / 2 : (idx * (W - 2 * P)) / (n - 1))
  const y = (v: number) => H - P - (Math.max(v, 0) / max) * (H - 2 * P)
  const line = (f: (r: SimResult['rows'][number]) => number) => res.rows.map((r, i) => `${x(i).toFixed(1)},${y(f(r)).toFixed(1)}`).join(' ')
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="none">
    <polyline fill="none" stroke="#8a97a8" stroke-width="2" points="${line((r) => r.principalYen)}"/>
    <polyline fill="none" stroke="#1f4f8f" stroke-width="2.5" points="${line((r) => r.valueYen)}"/></svg>
    <p class="note"><span class="lg l1"></span>評価額 <span class="lg l2"></span>元本</p>`
}

function render(input: SimInput): void {
  const errors = validateInput(input)
  errorsEl.textContent = errors.join(' ')
  if (errors.length > 0) {
    summaryEl.style.display = 'none'
    last = null
    return
  }
  const res = simulate(input)
  last = res
  const rule = RULES[input.account]
  $('final-value').textContent = `${input.years}年後の評価額: ${yen(res.finalValueYen)}`
  $('highlights').innerHTML = `
    <li>元本（積立総額）: ${yen(res.finalPrincipalYen)}</li>
    <li>運用益（仮定どおりの場合）: ${yen(res.finalGainYen)}</li>
    <li>課税口座で運用した場合の税引後評価額: ${yen(res.taxableAfterTaxYen)}（非課税メリットの目安: ${yen(res.taxSavedYen)}）</li>`
  $('cap-bar').style.width = `${Math.min(100, res.capUsedRatio * 100).toFixed(1)}%`
  $('cap-note').textContent =
    `非課税保有限度額（${yen(rule.totalCapYen)}）の使用率: ${(res.capUsedRatio * 100).toFixed(1)}%` +
    (res.capReachedMonth ? `（${Math.ceil(res.capReachedMonth / 12)}年目に上限へ到達し、以降の積立は行わない前提）` : '')
  $('chart').innerHTML = chartSvg(res)
  $('result-body').innerHTML = res.rows
    .map((r) => `<tr><td>${r.year}</td><td>${yen(r.principalYen)}</td><td>${yen(r.valueYen)}</td><td>${yen(r.gainYen)}</td></tr>`)
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
  render(readForm())
})
$('export-json').addEventListener('click', () => {
  const i = readForm()
  if (validateInput(i).length > 0) {
    errorsEl.textContent = '入力内容にエラーがあるため、エクスポートできません。'
    return
  }
  download(inputToJsonBlob(i), 'nisa-simulator-settings.json')
})
$('import-json').addEventListener('click', () => importFile.click())
importFile.addEventListener('change', async () => {
  const file = importFile.files?.[0]
  if (!file) return
  try {
    const i = parseInputFromJsonText(await file.text())
    fillForm(i)
    render(i)
  } catch (err) {
    errorsEl.textContent = err instanceof Error ? err.message : 'インポートに失敗しました。'
  } finally {
    importFile.value = ''
  }
})
$('export-csv').addEventListener('click', () => {
  if (!last) {
    errorsEl.textContent = '先に「試算する」を押して結果を表示してください。'
    return
  }
  download(buildCsvBlob(last), csvFileName())
})

const initial = loadInput() ?? DEFAULT_INPUT
fillForm(initial)
render(initial)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}
